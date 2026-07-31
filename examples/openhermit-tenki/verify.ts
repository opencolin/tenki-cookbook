/**
 * Live verification against a real Tenki sandbox. No mocks.
 *
 * Every check asserts on output from an actual Firecracker microVM. Any failure
 * throws immediately and exits non-zero -- this script is meant to be loud.
 *
 * Requires:
 *   TENKI_API_KEY (tk_...)   or TENKI_AUTH_TOKEN
 *   TENKI_PROJECT_ID
 *   TENKI_WORKSPACE_ID       (optional)
 *
 * Costs money: it boots a microVM, but it terminates the sandbox at the end --
 * even if a check throws (cleanup runs in a finally) -- so nothing is left
 * running to clean up.
 */

import { promises as fs } from 'node:fs';
import {
  JsonFileStateStore,
  backendFromEnv,
  toTenkiFsPath,
  DEFAULT_AGENT_HOME,
  type TenkiAgentSandbox,
} from './tenki-agent-sandbox.js';

const STATE_FILE = new URL('./.tenki-verify-state.json', import.meta.url).pathname;

let checkNumber = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `ASSERTION FAILED: ${message}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
    );
  }
}

async function check(name: string, fn: () => Promise<void> | void): Promise<void> {
  checkNumber += 1;
  const label = `${String(checkNumber).padStart(2, '0')}. ${name}`;
  const started = Date.now();
  try {
    await fn();
  } catch (err) {
    console.error(`FAIL ${label}`);
    throw err;
  }
  console.log(`ok   ${label} (${Date.now() - started}ms)`);
}

async function run(): Promise<void> {
  await fs.rm(STATE_FILE, { force: true });

  await check('credentials and project id are present', () => {
    const key = process.env['TENKI_API_KEY'] ?? process.env['TENKI_AUTH_TOKEN'];
    assert(key, 'TENKI_API_KEY (or TENKI_AUTH_TOKEN) must be set');
    assert(key.trim().length > 0, 'TENKI_API_KEY must not be empty or whitespace');
    // The SDK routes on the token's own prefix: tk_ -> Authorization: Bearer,
    // ory_st_ -> X-Session-Token, anything else -> Cookie: tenki_session=<token>.
    // All three authenticate; only a token you decorated yourself will not.
    if (!key.startsWith('tk_') && !key.startsWith('ory_st_')) {
      console.log(
        '     note: token is neither tk_... nor ory_st_..., so the SDK will send it as ' +
          'Cookie: tenki_session=<token>. That is the correct path for a raw dashboard ' +
          'session token -- pass it verbatim, with no prefix of your own.',
      );
    }
    // TENKI_PROJECT_ID is optional: if unset, the SDK resolves the single project
    // on your key -- that is how this runs in CI with only TENKI_API_KEY.
    if (!process.env['TENKI_PROJECT_ID']) {
      console.log('     note: TENKI_PROJECT_ID not set -- the SDK resolves the project from your key.');
    }
  });

  let backend: TenkiAgentSandbox = backendFromEnv(new JsonFileStateStore(STATE_FILE));
  const home = DEFAULT_AGENT_HOME;
  const notes = `${home}/work/notes.md`;
  const hidden = `${home}/work/.hidden`;
  const payload = 'tenki-cookbook-payload\n';

  try {
  await check('boots a sandbox and runs echo with exit 0', async () => {
    const result = await backend.exec('echo hello-from-tenki');
    assertEqual(result.exitCode, 0, 'echo should exit 0');
    assertEqual(result.stdout.trim(), 'hello-from-tenki', 'echo stdout');
  });

  await check('cwd and injected env reach the guest', async () => {
    const result = await backend.exec('printf "%s|%s" "$PWD" "$OPENHERMIT_CHECK"', {
      cwd: home,
      env: { OPENHERMIT_CHECK: 'wired' },
    });
    assertEqual(result.exitCode, 0, 'printf should exit 0');
    assertEqual(result.stdout.trim(), `${home}|wired`, 'cwd and env');
  });

  await check('non-zero exit codes are preserved, not thrown', async () => {
    const result = await backend.exec('echo to-stderr >&2; exit 42');
    assertEqual(result.exitCode, 42, 'exit code should pass through untouched');
    assert(result.stderr.includes('to-stderr'), 'stderr should be captured');
  });

  await check('a timed-out command is killed and reported as 137', async () => {
    const result = await backend.exec('sleep 10', { timeoutMs: 1500 });
    assertEqual(result.exitCode, 137, 'timeout should map to 137');
    assert(result.stderr.includes('timed out after 1500ms'), 'timeout message');
  });

  await check('writeFile / readFile round-trips exactly', async () => {
    await backend.writeFile(notes, payload);
    assertEqual(await backend.readText(notes), payload, 'file contents');
  });

  await check('stat reports size, isDir and a real mtime', async () => {
    const info = await backend.stat(notes);
    assert(info, 'stat should not be null for an existing file');
    assertEqual(info.isDir, false, 'notes.md is not a directory');
    assertEqual(info.size, Buffer.byteLength(payload), 'size in bytes');
    const parsed = Date.parse(info.modifiedIso);
    assert(Number.isFinite(parsed), `modifiedIso should parse, got ${info.modifiedIso}`);
    assert(parsed > Date.now() - 60 * 60 * 1000, 'mtime should be recent');
    assertEqual(await backend.stat(`${home}/work/does-not-exist`), null, 'missing file -> null');
  });

  await check('list includes hidden entries', async () => {
    await backend.writeFile(hidden, 'x');
    const names = (await backend.list(`${home}/work`)).map((entry) => entry.name);
    assert(names.includes('notes.md'), `expected notes.md in ${JSON.stringify(names)}`);
    assert(names.includes('.hidden'), `expected .hidden in ${JSON.stringify(names)}`);
  });

  await check('path translation refuses escapes from agent_home', () => {
    assertEqual(toTenkiFsPath(home, `${home}/work/a.txt`), 'work/a.txt', 'relative translation');
    assertEqual(toTenkiFsPath(home, home), '.', 'agent_home maps to .');
    let threw = false;
    try {
      toTenkiFsPath(home, '/etc/passwd');
    } catch {
      threw = true;
    }
    assert(threw, '/etc/passwd should be rejected');
  });

  await check('staged skill sync lands both scope roots', async () => {
    await backend.syncSkills([
      { scope: 'system', path: 'deploy/SKILL.md', contents: '# deploy skill\n' },
      { scope: 'user', path: 'notes/SKILL.md', contents: '# notes skill\n' },
    ]);
    const system = await backend.readText(`${home}/.openhermit/skills/system/deploy/SKILL.md`);
    const user = await backend.readText(`${home}/.openhermit/skills/user/notes/SKILL.md`);
    assertEqual(system, '# deploy skill\n', 'system skill contents');
    assertEqual(user, '# notes skill\n', 'user skill contents');
    const leftovers = await backend.exec(
      `ls -a ${home}/.openhermit/skills | grep -c '.tenki-stage-' || true`,
    );
    assertEqual(leftovers.stdout.trim(), '0', 'staging directory should be cleaned up');
  });

  await check('pause + resume survives a simulated gateway restart', async () => {
    await backend.shutdown();
    const persisted = JSON.parse(await fs.readFile(STATE_FILE, 'utf8')) as {
      sessionId?: string;
      state?: string;
    };
    assert(persisted.sessionId, 'sessionId should be persisted on shutdown');
    assertEqual(persisted.state, 'paused', 'persisted state should be paused');

    // Throw away the in-memory backend entirely; rebuild from the state file.
    backend = backendFromEnv(new JsonFileStateStore(STATE_FILE));
    const resumedAt = Date.now();
    const echo = await backend.exec('echo resumed');
    assertEqual(echo.exitCode, 0, 'exec after resume');
    assertEqual(echo.stdout.trim(), 'resumed', 'stdout after resume');
    assertEqual(await backend.readText(notes), payload, 'workspace file survived the pause');

    const after = JSON.parse(await fs.readFile(STATE_FILE, 'utf8')) as { sessionId?: string };
    assertEqual(after.sessionId, persisted.sessionId, 'must RESUME, not create a second sandbox');
    console.log(`     resumed the same sandbox in ${Date.now() - resumedAt}ms`);
  });
  } finally {
    // Cookbook cleanup. OpenHermit's backend only pauses (shutdown()); it never
    // deletes a sandbox, and close() after shutdown() is a no-op because
    // shutdown() drops the handle -- so the previous teardown (shutdown + close)
    // left a billable VM behind. terminate() deletes it, and the finally
    // guarantees that even a failed check cannot leak a sandbox.
    await backend.terminate();
  }
}

run().then(
  () => {
    console.log(`\nAll ${checkNumber} checks passed against live Tenki.`);
    console.log('Sandbox terminated -- nothing left to clean up.');
  },
  (err) => {
    console.error('\nVERIFICATION FAILED');
    console.error(err);
    process.exit(1);
  },
);
