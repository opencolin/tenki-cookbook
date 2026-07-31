# OpenHermit-style Tenki exec backend — runnable cookbook

A standalone, dependency-light reimplementation of the lifecycle that OpenHermit's `TenkiExecBackend` (PR #239, merged 2026-07-17) uses: sticky session create, exec with a real kill-on-timeout, workspace-relative file operations, staged skill sync with rollback, and pause/resume across a simulated gateway restart.

Everything here calls the live Tenki API through `@tenkicloud/sandbox`. There are no mocks and no fixtures.

## Files

| File | What it is |
| --- | --- |
| `tenki-agent-sandbox.ts` | The backend. Also runs a demo when executed directly. |
| `verify.ts` | Live assertions against a real Tenki sandbox. Fails loudly with a non-zero exit. |
| `package.json` | Dependencies and scripts. |
| `tsconfig.json` | Strict TypeScript config. |

## Setup

```bash
npm install

export TENKI_API_KEY=tk_your_key_here        # or TENKI_AUTH_TOKEN
export TENKI_PROJECT_ID=your-tenki-project-id
export TENKI_WORKSPACE_ID=your-tenki-workspace-id   # optional
```

Prefer a `tk_...` project/API key. The SDK picks the auth header from the token's own prefix: `tk_...` → `Authorization: Bearer`, `ory_st_...` → `X-Session-Token`, anything else → `Cookie: tenki_session=<token>`. So a raw token copied out of a logged-in dashboard session authenticates too, on that last branch — pass it **verbatim**. Do not prepend anything to it; the SDK interpolates the value straight into the cookie, so any prefix you add lands inside the cookie value and 401s.

## Run

```bash
npm run demo         # walks through create -> exec -> files -> skills -> pause -> resume
npm run verify       # 11 assertions against live Tenki; exits 1 on the first failure
node verify.mjs      # same as `npm run verify` — the cookbook's standard CI entrypoint (shims to tsx)
```

`TENKI_PROJECT_ID` is optional: with only a `TENKI_API_KEY` set, the SDK resolves the single project on your key (that is how this runs in CI).

**This costs money.** Both scripts boot a real Firecracker microVM. Tenki's own figure for cold boot is roughly 2 seconds — that is their number, not one measured here, so verify at [tenki.cloud/docs](https://tenki.cloud/docs); the very first provision of a new sandbox takes longer than a resume either way. **Both scripts terminate the sandbox when they finish — in a `finally`, so even a failed check cleans up — so nothing is left running or paused to delete.** (Live-verified: after a run the project shows zero non-terminated sandboxes.)

Both scripts persist their session id to `./.tenki-runtime-state.json`, standing in for the `runtime_state` column on OpenHermit's `sandboxes` row. The pause → resume roundtrip *within* a run is the behavior worth watching — the restart step throws away the in-memory backend, rebuilds from the state file, and resumes the **same** session id (never a second sandbox). Because each run terminates its sandbox at the end, a *second* run starts fresh. To watch a resume span two separate runs, comment out the final `terminate()`; then re-running `npm run demo` resumes from the state file. Delete that file (and the sandbox) when done.

A pause is not indefinite: the SDK takes `pauseRetentionMs` on create and exposes `pauseExpiresAt` on the session, and neither OpenHermit nor this cookbook sets a retention value, so your project default applies. Come back to a stale state file after that window and the resume path falls through to `SessionExpiredError` and creates a fresh, empty sandbox instead.

## What `verify.ts` asserts

1. Credentials and `TENKI_PROJECT_ID` are present.
2. `echo` returns exit 0 and the exact expected stdout.
3. `cwd` and injected `env` reach the guest.
4. A non-zero exit (`exit 42`) is preserved as 42, not converted to a throw.
5. A command exceeding `timeoutMs` is killed and reported as exit 137.
6. `writeFile` / `readFile` round-trips bytes exactly.
7. `stat` reports `isDir: false`, the right size, and a parseable mtime derived from the `modifiedUnixNs` bigint.
8. `list` with `includeHidden: true` returns a dotfile. Worth knowing: the SDK's `list()` returns `FileInfo[]` — `{path, size, mode, isDir, modifiedUnixNs}`, with no `name` field — so `list()` here derives the entry name with `path.posix.basename(e.path)`, the same way the upstream backend does. Passing the SDK's entries through while declaring a `{name: string}[]` return type is a hard `TS2322`; leaving it untyped just gives you `undefined` at every call site.
9. `toTenkiFsPath` rejects a path outside `agent_home`.
10. Staged skill sync lands both `system` and `user` skill files.
11. **Restart survival:** pause, assert the persisted `state` is `paused` and a `sessionId` was written, throw away the in-memory backend, construct a new one from the persisted state file, resume, read back the file written before the pause, and assert the session id is *unchanged* — proving it resumed rather than creating a second sandbox.

Assertion 11 is the one that matters. If it passes, an OpenHermit gateway can restart without re-provisioning agent workspaces.

**Run green against live Tenki (2026-07-28), `@tenkicloud/sandbox` 0.3.7:** all **11/11** checks pass, including the ~60s pause→resume roundtrip, and the sandbox is terminated at the end (project left with zero non-terminated sandboxes). Auth was a `tk_` key → `Authorization: Bearer` (the raw-token → `Cookie` branch is the SDK's fallback, not needed here).

Every check goes through `assert()` / `assertEqual()`, which throw on failure; the top-level handler prints `VERIFICATION FAILED` and calls `process.exit(1)`. There is no "soft fail" path — the first failed assertion stops the run.

## Relationship to the upstream backend

This is a standalone reimplementation, not a copy. Two places where it deliberately simplifies:

- Upstream persists the session record at `runtime_state.tenki` (`saveState()` writes `{...current, tenki: persisted}`; `loadState()` reads `state['tenki']`). Only `tenki_pending_skills` sits at the top level of `runtime_state`. Here the whole state file *is* the runtime_state stand-in, so both are flat in one JSON blob. The `state` values match upstream: `'active'` / `'paused'`.
- Upstream resolves credentials and config through the agent's exec-backend plumbing; here they come from env vars.

## Version notes

- No published `openhermit` release contains the Tenki backend yet: `0.10.0` shipped 2026-07-06 and PR #239 merged 2026-07-17. To use it in a real OpenHermit gateway you need a clone of `main` (`git clone https://github.com/HCF-STUDIOS/openhermit && cd openhermit && npm install`). This cookbook does not depend on OpenHermit at all — it only needs `@tenkicloud/sandbox`.
- `@tenkicloud/sandbox` is pinned to `^0.3.6` here to match what `apps/agent/package.json` declares in the merged PR. The latest published SDK is `0.5.2`.
- OpenHermit's own `docs/sandbox-model.md` still documents only host/docker/e2b/daytona. This cookbook is derived from the merged source, not from upstream docs.
