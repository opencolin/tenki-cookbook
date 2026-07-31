/**
 * OpenHermit-style Tenki exec backend, standalone and runnable.
 *
 * Mirrors the lifecycle of apps/agent/src/core/backends/tenki.ts from
 * HCF-STUDIOS/openhermit PR #239 (merged 2026-07-17):
 *
 *   - sticky session create, only when there is no resumable persisted session
 *   - resume-from-persisted-state across a gateway restart
 *   - recreate ONLY on SessionExpired/NotFound/Terminated (or TERMINATED /
 *     USER_SHUTDOWN state); rethrow everything else so a bad API key does not
 *     become a microVM factory
 *   - exec that races a real timer and kills the handle -> exit 137
 *   - workspace-relative path translation for SDK fs calls
 *   - staged skill sync with an EXIT-trap rollback
 *
 * The `runtime_state` column on OpenHermit's `sandboxes` row is replaced here by
 * a JSON file, so you can watch the resume path work without a database.
 *
 * Note on retention: a paused session is not resumable forever. The SDK takes
 * `pauseRetentionMs` on create and exposes `pauseExpiresAt` on the session;
 * neither OpenHermit nor this file sets a value, so the project default applies.
 * Past that window, tryResume() takes the SessionExpiredError branch and you get
 * a new, empty sandbox rather than your old workspace.
 */

import { promises as fs } from 'node:fs';
import { posix as posixPath } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  TenkiSandbox,
  SessionExpiredError,
  SessionNotFoundError,
  SessionTerminatedError,
  FileNotFoundError,
} from '@tenkicloud/sandbox';

/** The SDK's Session type, without depending on its export name. */
type Session = Awaited<ReturnType<TenkiSandbox['createAndWait']>>;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Mirrors TenkiExecBackendConfig in apps/agent/src/core/exec-backend.ts. */
export interface TenkiBackendConfig {
  /** Tenki project id. Optional here: when omitted, the SDK resolves the single
   *  project on your key -- which is what lets this run in CI with just a key.
   *  The real OpenHermit backend requires it (`z.string().min(1)`); a cookbook
   *  example that must run from a bare key should not. */
  project_id?: string;
  workspace_id?: string;
  cpu_cores?: number;
  memory_mb?: number;
  disk_size_gb?: number;
  agent_home?: string;
  /** Per-command exec timeout. */
  timeout_ms?: number;
  /** Self-hosted / non-default control plane. */
  base_url?: string;
  /** Stamped into session metadata as { agentId }. */
  agent_id?: string;
}

export const DEFAULT_AGENT_HOME = '/home/tenki';
export const DEFAULT_CPU_CORES = 2;
export const DEFAULT_MEMORY_MB = 4096;
export const DEFAULT_DISK_SIZE_GB = 10;
export const DEFAULT_EXEC_TIMEOUT_MS = 300_000;
export const DEFAULT_READY_TIMEOUT_MS = 180_000;

// ---------------------------------------------------------------------------
// Persisted runtime state (stands in for the sandboxes.runtime_state column)
// ---------------------------------------------------------------------------

export interface SkillFile {
  scope: 'system' | 'user';
  /** Path relative to the scope root, e.g. "deploy/SKILL.md". */
  path: string;
  contents: string | Uint8Array;
}

/**
 * Upstream nests the session record under the `tenki` key of the sandbox row's
 * runtime_state -- saveState() writes `{...current, tenki: persisted}` and
 * loadState() reads `state['tenki']`, so it is `runtime_state.tenki =
 * {sessionId, cwd, updatedAt, state}`. `tenki_pending_skills` is the one field
 * that really does sit at the top level of runtime_state.
 *
 * This file flattens the two into a single JSON blob because the whole
 * runtime_state column is a standalone file here. The `state` values match
 * upstream: 'active' when the session is up, 'paused' after shutdown().
 */
export interface RuntimeState {
  sessionId?: string;
  cwd?: string;
  updatedAt?: string;
  state?: 'active' | 'paused';
  /** Parked skill sync, replayed on the next successful ensure(). */
  tenki_pending_skills?: SkillFile[];
}

export interface RuntimeStateStore {
  load(): Promise<RuntimeState | null>;
  save(state: RuntimeState): Promise<void>;
}

export class JsonFileStateStore implements RuntimeStateStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<RuntimeState | null> {
    try {
      return JSON.parse(await fs.readFile(this.filePath, 'utf8')) as RuntimeState;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
      throw err;
    }
  }

  async save(state: RuntimeState): Promise<void> {
    await fs.writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();
const decode = (bytes: Uint8Array | undefined): string => (bytes ? decoder.decode(bytes) : '');
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Errors that mean "the sandbox is gone, make a new one". */
const RECREATE_ERRORS = [SessionExpiredError, SessionNotFoundError, SessionTerminatedError];
/** Session states that mean the same thing. */
const RECREATE_STATES = new Set(['TERMINATED', 'USER_SHUTDOWN']);

function shouldRecreate(err: unknown): boolean {
  return RECREATE_ERRORS.some((ErrorClass) => err instanceof ErrorClass);
}

/**
 * The SDK's fs methods are relative to the sandbox workdir; agent tools speak
 * absolute guest paths. Strip the agent_home prefix, map agent_home itself to
 * ".", and refuse anything outside the workspace.
 *
 * Mirrors toTenkiFsPath() exported from file-backend.ts.
 */
export function toTenkiFsPath(agentHome: string, filePath: string): string {
  const home = agentHome.replace(/\/+$/, '');
  if (!filePath.startsWith('/')) return filePath;
  if (filePath === home) return '.';
  if (!filePath.startsWith(`${home}/`)) {
    throw new Error(`Path is outside the agent workspace (${home}): ${filePath}`);
  }
  return filePath.slice(home.length + 1);
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface StatResult {
  isDir: boolean;
  size: number;
  modifiedIso: string;
}

/**
 * What list() hands back.
 *
 * The SDK's `session.list()` returns `FileInfo[]` -- `{path, size, mode, isDir,
 * modifiedUnixNs}`. There is no `name` field, so callers that want a bare entry
 * name have to derive it. Upstream's TenkiFileBackend.list() does exactly this
 * with `path.posix.basename(e.path)`; returning the SDK objects unchanged and
 * reading `.name` off them yields `undefined` at runtime.
 */
export interface DirEntry {
  name: string;
  /** The path as the SDK reported it. */
  path: string;
  isDir: boolean;
  size: number;
}

// ---------------------------------------------------------------------------
// The backend
// ---------------------------------------------------------------------------

export class TenkiAgentSandbox {
  private readonly client: TenkiSandbox;
  private readonly agentHome: string;
  private readonly execTimeoutMs: number;
  private session: Session | null = null;
  private ensureInFlight: Promise<Session> | null = null;

  constructor(
    private readonly config: TenkiBackendConfig,
    private readonly store: RuntimeStateStore,
  ) {
    // Exactly what OpenHermit reads, including the fallback name.
    const apiKey = process.env['TENKI_API_KEY'] ?? process.env['TENKI_AUTH_TOKEN'];
    if (!apiKey) {
      throw new Error(
        'TENKI_API_KEY environment variable is not set. ' +
          'Add it to ~/.openhermit/gateway/.env to use the tenki backend.',
      );
    }
    this.client = new TenkiSandbox({
      authToken: apiKey,
      ...(config.base_url ? { baseUrl: config.base_url } : {}),
    });
    this.agentHome = config.agent_home ?? DEFAULT_AGENT_HOME;
    this.execTimeoutMs = config.timeout_ms ?? DEFAULT_EXEC_TIMEOUT_MS;
  }

  get home(): string {
    return this.agentHome;
  }

  // -- state ---------------------------------------------------------------

  private async update(patch: Partial<RuntimeState>): Promise<RuntimeState> {
    const current = (await this.store.load()) ?? {};
    const next: RuntimeState = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await this.store.save(next);
    return next;
  }

  // -- ensure --------------------------------------------------------------

  /**
   * Deduped so parallel callers cannot double-create a sandbox
   * (`ensureInFlight` in the real backend).
   */
  async ensure(): Promise<Session> {
    if (this.session) return this.session;
    if (!this.ensureInFlight) {
      this.ensureInFlight = this.doEnsure().finally(() => {
        this.ensureInFlight = null;
      });
    }
    return this.ensureInFlight;
  }

  private async doEnsure(): Promise<Session> {
    const persisted = await this.store.load();
    let session: Session | null = null;

    if (persisted?.sessionId) {
      session = await this.tryResume(persisted.sessionId);
    }

    const created = session === null;
    if (!session) {
      session = await this.client.createAndWait({
        ...(this.config.project_id ? { projectId: this.config.project_id } : {}),
        ...(this.config.workspace_id ? { workspaceId: this.config.workspace_id } : {}),
        cpuCores: this.config.cpu_cores ?? DEFAULT_CPU_CORES,
        memoryMb: this.config.memory_mb ?? DEFAULT_MEMORY_MB,
        diskSizeGb: this.config.disk_size_gb ?? DEFAULT_DISK_SIZE_GB,
        sticky: true,
        metadata: { agentId: this.config.agent_id ?? 'main' },
        timeoutMs: DEFAULT_READY_TIMEOUT_MS,
      });
    }

    try {
      await this.update({ sessionId: session.id, cwd: this.agentHome, state: 'active' });
    } catch (err) {
      // Never leak an orphan microVM we just created and can no longer address.
      if (created) await session.closeIfOpen().catch(() => undefined);
      throw err;
    }

    this.session = session;
    await this.ensureDirectories(session, [this.agentHome]);
    await this.flushPendingSkills();
    return session;
  }

  /**
   * Returns null when the persisted session is genuinely gone. Rethrows
   * anything else -- an UnauthorizedError must NOT produce a duplicate sandbox.
   */
  private async tryResume(sessionId: string): Promise<Session | null> {
    try {
      const session = await this.client.get(sessionId);
      if (RECREATE_STATES.has(session.state)) return null;
      if (session.state === 'PAUSED') await session.resume();
      if (session.state !== 'RUNNING') await session.waitReady(DEFAULT_READY_TIMEOUT_MS);
      return session;
    } catch (err) {
      if (shouldRecreate(err)) return null;
      throw err;
    }
  }

  /** mkdir -p with backoff: the guest agent accepts connections before the fs settles. */
  private async ensureDirectories(session: Session, dirs: string[]): Promise<void> {
    if (dirs.length === 0) return;
    const script = dirs.map((dir) => `mkdir -p '${dir}'`).join(' && ');
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const result = await session.run(['sh', '-c', script], { cwd: '/' });
        if (result.exitCode === 0) return;
        lastError = new Error(`mkdir exited ${result.exitCode}: ${decode(result.stderr)}`);
      } catch (err) {
        lastError = err;
      }
      await delay(200 * 2 ** attempt);
    }
    throw lastError ?? new Error('Failed to create agent directories');
  }

  // -- exec ----------------------------------------------------------------

  /**
   * Non-zero exit codes are preserved as-is. A timeout kills the handle and
   * reports 137. A thrown SDK error nulls the cached session (so the next call
   * re-ensures) and reports 1.
   */
  async exec(
    command: string,
    options: { cwd?: string; env?: Record<string, string>; timeoutMs?: number } = {},
  ): Promise<ExecResult> {
    const session = await this.ensure();
    const timeoutMs = options.timeoutMs ?? this.execTimeoutMs;
    const handle = session.run(['sh', '-c', command], {
      cwd: options.cwd ?? this.agentHome,
      ...(options.env ? { env: options.env } : {}),
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutSentinel = Symbol('timeout');
      const raced = await Promise.race([
        handle,
        new Promise<typeof timeoutSentinel>((resolve) => {
          timer = setTimeout(() => resolve(timeoutSentinel), timeoutMs);
        }),
      ]);

      if (raced === timeoutSentinel) {
        await handle.kill().catch(() => undefined);
        return { exitCode: 137, stdout: '', stderr: `Command timed out after ${timeoutMs}ms` };
      }

      return {
        exitCode: raced.exitCode,
        stdout: decode(raced.stdout),
        stderr: decode(raced.stderr),
      };
    } catch (err) {
      this.session = null;
      return { exitCode: 1, stdout: '', stderr: err instanceof Error ? err.message : String(err) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // -- files ---------------------------------------------------------------

  /** @param filePath absolute guest path, e.g. /home/tenki/work/notes.md */
  async writeFile(filePath: string, contents: string | Uint8Array): Promise<void> {
    const session = await this.ensure();
    const relative = toTenkiFsPath(this.agentHome, filePath);
    const parent = filePath.slice(0, filePath.lastIndexOf('/'));
    if (parent && parent !== this.agentHome) await this.ensureDirectories(session, [parent]);
    const bytes = typeof contents === 'string' ? Buffer.from(contents, 'utf8') : contents;
    await session.writeFile(relative, bytes);
  }

  async readFile(filePath: string): Promise<Uint8Array> {
    const session = await this.ensure();
    return session.readFile(toTenkiFsPath(this.agentHome, filePath));
  }

  async readText(filePath: string): Promise<string> {
    return decode(await this.readFile(filePath));
  }

  /** Appends via stdin rather than read-modify-write; absolute path, shell side. */
  async appendFile(filePath: string, contents: string): Promise<ExecResult> {
    toTenkiFsPath(this.agentHome, filePath); // validate the path first
    const escaped = contents.replace(/'/g, `'\\''`);
    return this.exec(`printf '%s' '${escaped}' >> "${filePath}"`);
  }

  /** Returns null only for FileNotFoundError; anything else invalidates the session. */
  async stat(filePath: string): Promise<StatResult | null> {
    const session = await this.ensure();
    try {
      const info = await session.stat(toTenkiFsPath(this.agentHome, filePath));
      return {
        isDir: info.isDir,
        size: Number(info.size),
        modifiedIso: new Date(Number(info.modifiedUnixNs / 1_000_000n)).toISOString(),
      };
    } catch (err) {
      if (err instanceof FileNotFoundError) return null;
      this.session = null;
      throw err;
    }
  }

  /** `includeHidden: true` because agents keep dotfiles. */
  async list(dirPath: string): Promise<DirEntry[]> {
    const session = await this.ensure();
    const entries = await session.list(toTenkiFsPath(this.agentHome, dirPath), {
      includeHidden: true,
    });
    // FileInfo carries `path`, not `name` -- derive the basename, same as upstream.
    return entries.map((entry) => ({
      name: posixPath.basename(entry.path),
      path: entry.path,
      isDir: entry.isDir,
      size: Number(entry.size),
    }));
  }

  // -- skills --------------------------------------------------------------

  /**
   * Upload skills into a staging directory, then swap both scope roots into
   * place with one script that rolls back through an EXIT trap on failure.
   * If the backend is disconnected, park the list and replay on next ensure().
   */
  async syncSkills(files: SkillFile[]): Promise<void> {
    if (!this.session) {
      await this.update({ tenki_pending_skills: files });
      return;
    }
    const session = this.session;
    const skillsRoot = `${this.agentHome}/.openhermit/skills`;
    const stage = `${skillsRoot}/.tenki-stage-${randomUUID()}`;

    // Both scope roots must exist in the stage even when a scope has no files.
    // The swap below moves `$root/<scope>` into the backup unconditionally and
    // only moves a replacement in if `$stage/<scope>` exists -- and then deletes
    // the backup. A missing stage scope would therefore silently wipe that
    // scope's existing skills. Upstream mkdir -p's `${stageDir}/system` and
    // `${stageDir}/user` up front for exactly this reason.
    const dirs = new Set<string>([stage, `${stage}/system`, `${stage}/user`]);
    for (const file of files) {
      const abs = `${stage}/${file.scope}/${file.path}`;
      dirs.add(abs.slice(0, abs.lastIndexOf('/')));
    }
    await this.ensureDirectories(session, [skillsRoot, ...dirs]);

    for (const file of files) {
      const abs = `${stage}/${file.scope}/${file.path}`;
      const bytes =
        typeof file.contents === 'string' ? Buffer.from(file.contents, 'utf8') : file.contents;
      await session.writeFile(toTenkiFsPath(this.agentHome, abs), bytes);
    }

    const swap = [
      'set -eu',
      'root="$1"; stage="$2"',
      'backup="$root/.tenki-backup-$$"',
      'mkdir -p "$root" "$backup"',
      'rollback() {',
      '  for d in system user; do',
      '    if [ -d "$backup/$d" ]; then rm -rf "$root/$d"; mv "$backup/$d" "$root/$d"; fi',
      '  done',
      '  rm -rf "$stage" "$backup"',
      '}',
      'trap rollback EXIT',
      'for d in system user; do',
      '  if [ -d "$root/$d" ]; then mv "$root/$d" "$backup/$d"; fi',
      '  if [ -d "$stage/$d" ]; then mv "$stage/$d" "$root/$d"; fi',
      'done',
      'trap - EXIT',
      'rm -rf "$stage" "$backup"',
    ].join('\n');

    const result = await session.run(['sh', '-c', swap, 'skill-sync', skillsRoot, stage], {
      cwd: this.agentHome,
    });
    if (result.exitCode !== 0) {
      throw new Error(`Skill sync swap failed (${result.exitCode}): ${decode(result.stderr)}`);
    }
    await this.update({ tenki_pending_skills: [] });
  }

  private async flushPendingSkills(): Promise<void> {
    const state = await this.store.load();
    const pending = state?.tenki_pending_skills;
    if (pending && pending.length > 0) await this.syncSkills(pending);
  }

  // -- lifecycle -----------------------------------------------------------

  /** Pause and persist. Keeps the handle if pause fails, same as the real backend. */
  async shutdown(): Promise<void> {
    const session = this.session;
    if (!session) return;
    try {
      await session.pause();
    } catch (err) {
      console.warn(`[tenki] pause failed, keeping handle: ${String(err)}`);
      return;
    }
    await this.update({ sessionId: session.id, cwd: this.agentHome, state: 'paused' });
    this.session = null;
  }

  /**
   * Release the local handle. NOTE: the SDK's Session.close() issues a
   * terminateSession RPC, so closeIfOpen() *does* delete the sandbox when the
   * session is still open. This method exists to model the real backend's
   * "drop the handle" step; for guaranteed cleanup that also reconnects by the
   * persisted id, use terminate().
   *
   * Ordering caveat that bit the cookbook: shutdown() sets this.session = null,
   * so calling close() *after* shutdown() is a no-op and the paused sandbox is
   * left behind. Terminate via terminate(), not shutdown()+close().
   */
  async close(): Promise<void> {
    const session = this.session;
    this.session = null;
    if (session) await session.closeIfOpen().catch(() => undefined);
  }

  /**
   * Cookbook cleanup only -- NOT part of the OpenHermit backend contract. The
   * real backend never deletes a sandbox; it only pauses (shutdown()) so the
   * workspace survives a gateway restart. A demo or CI run, though, must not
   * leave a billable VM running, so delete it explicitly. Terminates the live
   * handle if present, otherwise reconnects by the persisted session id;
   * never creates a sandbox just to delete it.
   */
  async terminate(): Promise<void> {
    let session = this.session;
    this.session = null;
    if (!session) {
      const persisted = await this.store.load().catch(() => null);
      if (!persisted?.sessionId) return;
      try {
        session = await this.client.get(persisted.sessionId);
      } catch {
        return; // already gone
      }
    }
    await session.close(); // SDK Session.close() issues terminateSession()
  }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

export const STATE_FILE = new URL('./.tenki-runtime-state.json', import.meta.url).pathname;

export function backendFromEnv(store: RuntimeStateStore): TenkiAgentSandbox {
  // TENKI_PROJECT_ID is optional: omit it and the SDK resolves the single project
  // on your key. That is what lets this run in CI with only TENKI_API_KEY.
  const projectId = process.env['TENKI_PROJECT_ID'];
  return new TenkiAgentSandbox(
    {
      ...(projectId ? { project_id: projectId } : {}),
      ...(process.env['TENKI_WORKSPACE_ID']
        ? { workspace_id: process.env['TENKI_WORKSPACE_ID'] }
        : {}),
      cpu_cores: 2,
      memory_mb: 4096,
      disk_size_gb: 10,
      agent_home: DEFAULT_AGENT_HOME,
      agent_id: 'cookbook',
    },
    store,
  );
}

async function main(): Promise<void> {
  const store = new JsonFileStateStore(STATE_FILE);
  const backend = backendFromEnv(store);
  const notes = `${backend.home}/work/notes.md`;

  console.log('booting sandbox (resumes if ./.tenki-runtime-state.json exists)...');
  const started = Date.now();
  await backend.ensure();
  console.log(`ready in ${Date.now() - started}ms`);

  console.log('\n$ uname -a');
  console.log((await backend.exec('uname -a')).stdout.trim());

  console.log('\n$ echo "$AGENT" (injected env)');
  console.log((await backend.exec('echo "$AGENT"', { env: { AGENT: 'cookbook' } })).stdout.trim());

  console.log('\nwriting + appending + reading a workspace file');
  await backend.writeFile(notes, '# agent notes\n');
  await backend.appendFile(notes, 'appended without read-modify-write\n');
  console.log(await backend.readText(notes));

  const info = await backend.stat(notes);
  console.log(`stat: isDir=${info?.isDir} size=${info?.size} modified=${info?.modifiedIso}`);

  console.log('\nsyncing two skills through the staged swap');
  await backend.syncSkills([
    { scope: 'system', path: 'deploy/SKILL.md', contents: '# deploy\n' },
    { scope: 'user', path: 'notes/SKILL.md', contents: '# notes\n' },
  ]);
  console.log((await backend.exec(`ls ${backend.home}/.openhermit/skills`)).stdout.trim());

  console.log('\nnon-zero exits pass through:');
  console.log(`  exit 42 -> ${(await backend.exec('exit 42')).exitCode}`);
  console.log(`  sleep 5 (1s budget) -> ${(await backend.exec('sleep 5', { timeoutMs: 1000 })).exitCode}`);

  console.log('\npausing (this is what OpenHermit does on agent stop)...');
  await backend.shutdown();

  console.log('simulating a gateway restart: new backend, same state file...');
  const restarted = backendFromEnv(new JsonFileStateStore(STATE_FILE));
  const resumedAt = Date.now();
  await restarted.ensure();
  console.log(`resumed in ${Date.now() - resumedAt}ms`);
  console.log('file survived the restart:');
  console.log(await restarted.readText(notes));

  // Cookbook cleanup: delete the sandbox so this demo leaves nothing billing.
  // (In production you would NOT do this -- pausing on stop is the whole point
  // of the backend; the workspace is meant to survive the restart.)
  await restarted.terminate();
  console.log('sandbox terminated -- nothing left to clean up.');
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
