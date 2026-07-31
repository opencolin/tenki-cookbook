# Hermes Agent on Tenki

Run [Hermes Agent](https://github.com/NousResearch/hermes-agent)'s shell tool inside a
Tenki microVM instead of on your laptop.

Hermes runs every shell command through a pluggable *terminal backend*. This example
drives the **real** Tenki backend — `tools/environments/tenki.py` — imported from a
checkout of the PR that adds it. Nothing here is a reimplementation: `TenkiEnvironment`
and `BaseEnvironment.execute()` are exactly what the agent calls when
`terminal.backend` is `tenki`.

You need a `TENKI_API_KEY`. No model or LLM key: this exercises the terminal backend,
not the agent loop.

---

## Status: the backend is not merged yet

`tools/environments/tenki.py` exists **only on open PR branches**. It is not on any
default branch, and there is no package to `pip install`.

| PR | Repo | State |
|---|---|---|
| [#1](https://github.com/LuxorLabs/tenki-hermes-agent/pull/1) | `LuxorLabs/tenki-hermes-agent` (fork) | **open**, not merged |
| [#64190](https://github.com/NousResearch/hermes-agent/pull/64190) | `NousResearch/hermes-agent` (upstream) | **open**, not merged |

`setup.sh` clones the fork and checks out PR #1. To use the upstream PR instead:

```bash
HERMES_UPSTREAM=https://github.com/NousResearch/hermes-agent.git HERMES_PR=64190 ./setup.sh
```

### Known blocker: the pinned SDK version does not exist

The PR pins `tenki-sandbox==0.3.1` in both `tools/lazy_deps.py` and `pyproject.toml`.
**That version was never published to PyPI** — it 404s. Published versions are
`0.1.0`, `0.1.1`, `0.3.5`, `0.3.6`, `0.4.0`.

This is not a documentation nit — in any normal install it stops the backend from
starting. `TenkiEnvironment.__init__` calls `lazy_deps.ensure("terminal.tenki", prompt=False)`
*before* importing the SDK. Whenever `packaging` is importable — it almost always is, since
pip and most libraries pull it in — `lazy_deps._is_satisfied()` compares the **installed**
version against the pin, so even with a working `tenki-sandbox` already installed the pin
reads as unsatisfied, `ensure()` shells out to pip, pip 404s, and you get:

```
ImportError: Feature 'terminal.tenki' unavailable: pip install failed:
ERROR: Could not find a version that satisfies the requirement tenki-sandbox==0.3.1
(from versions: 0.1.0, 0.1.1, 0.3.5, 0.3.6, 0.4.0)
```

(Edge case: if `packaging` is *not* importable — a bare venv with nothing but these
three deps — `_is_satisfied()` falls back to a presence-only check, the pin passes, and
the backend starts anyway. That is the exception, not the rule; a real Hermes install
has `packaging`.)

`setup.sh` repins to `0.4.0` after checkout so this example runs today. The real fix
belongs in the PR. Every SDK call the backend makes exists in `0.4.0` — verified
against the wheel:

- `Client.create(project_id, cpu_cores, memory_mb, disk_size_gb, tags, metadata, image, sticky, idle_timeout_minutes, pause_retention)`, `Client.list(tags=...)`, `Client.who_am_i()`, `Client.close()`
- `Sandbox.id/.state/.refresh()/.wait_ready()/.exec()/.pause()/.resume()/.close()/.fs`
- `SandboxFS.mkdir/upload/download/write_bytes`
- `CommandResult.exit_code/.stdout_text/.stderr_text/.check()`

---

## Run it

Python 3.10+ (the SDK requires it, and the backend uses `str | None` annotations
at runtime).

```bash
export TENKI_API_KEY=tk_...
# Only if your key maps to more than one project — it is auto-detected otherwise:
# export TENKI_PROJECT_ID=proj_...

./setup.sh                          # clone PR branch + repin the SDK
pip install -r requirements.txt
python verify.py                    # asserts against live Tenki, exits non-zero on mismatch
python main.py                      # narrated walkthrough
```

**One-shot (what CI runs):** `node verify.mjs` — it runs `setup.sh` for you (if the backend isn't checked out yet), then `verify.py`. That is the cookbook's standard entrypoint; CI installs `requirements.txt` first and runs it with only a `TENKI_API_KEY` (the project is resolved from the key).

`verify.py` prints a PASS/FAIL line per check and exits `0` only if all pass:

```
[1] Hermes backend gate
  PASS  check_terminal_requirements() accepts tenki
  PASS  task tag format
...
============================================================
OK: all 19 checks passed
```

### What `verify.py` checks

| # | Check |
|---|---|
| 1 | Hermes' own `check_terminal_requirements()` accepts the `tenki` backend |
| 2 | Sandbox creation; `cwd="~"` resolves to the sandbox `$HOME` (`/home/tenki`) |
| 3 | Shell command roundtrip |
| 4 | Exit codes propagate to the agent |
| 5 | stderr is surfaced in `output` |
| 6 | cwd tracked across separate `execute()` calls |
| 7 | File write + read back at the agent home |
| 8 | stdin via heredoc mode, including a byte-count guard |
| 9 | Persistence: pause → reattach by `task_id` → same sandbox id, filesystem intact |

Check 8 is a regression guard for a real bug the PR's second commit fixed: on
heredoc-mode backends the base class appended stdin at the *end* of the command, so it
bound to the trailing `trap` instead of the mid-script `cat` and wrote **empty files**.

The run costs two sandbox lifecycles and terminates both — including on failure, via an
outer `finally`. `TenkiEnvironment.cleanup()` only *pauses* a persistent sandbox (that
is the whole point of the backend), so the scripts close them explicitly through the SDK
using the backend's own `_task_tag()` helper.

---

## How the backend behaves

```python
from tools.environments.tenki import TenkiEnvironment

env = TenkiEnvironment(
    cwd="~",                    # remapped onto the detected sandbox $HOME
    timeout=120,
    cpu=1,
    memory=2048,                # MB
    disk=10240,                 # MB — the backend converts to GB (ceil)
    persistent_filesystem=True, # cleanup() pauses instead of destroying
    task_id="my-task",          # keys the sandbox tag: hermes-my-task
)
result = env.execute("echo hello")   # {"output": ..., "returncode": 0}
env.cleanup()
```

**Persistence** is what makes this backend interesting for a long-lived agent. With
`persistent_filesystem=True`, `cleanup()` pauses the microVM instead of destroying it.
The sandbox is tagged `hermes-<task_id>` with metadata `{"hermes_task_id": task_id}`,
created `sticky=True` with `idle_timeout_minutes=120` and `pause_retention=86400`. A
later `TenkiEnvironment` with the same `task_id` calls
`client.list(tags=["hermes-<task_id>"])`, skips `TERMINATING`/`TERMINATED`, and resumes
the same filesystem. Tenki microVMs boot in about 2 seconds.

Resource arguments come from Hermes in MB and are converted in the constructor:
`cpu_cores = max(1, cpu)`, `memory_mb = max(512, memory)`,
`disk_gb = max(1, ceil(disk / 1024))`.

`main.py` reads `env._sandbox.id` to show the sandbox identity. That is private
introspection for the demo, not part of the backend's contract.

---

## Using it from the agent, not the API

Once the PR lands:

```bash
export TENKI_API_KEY=tk_...
hermes config set terminal.backend tenki
hermes
```

Or via `TERMINAL_ENV=tenki`. In `~/.hermes/config.yaml` the keys are nested under
`terminal:` — they are not top-level:

```yaml
terminal:
  backend: "tenki"
  cwd: "~"                # resolved to the sandbox home
  timeout: 180
  tenki_image: ""         # a Tenki REGISTRY ref, not a Docker Hub image;
                          # empty means Tenki picks its default base image
```

Shared container knobs also apply (`TERMINAL_CONTAINER_CPU`,
`TERMINAL_CONTAINER_MEMORY` MB, `TERMINAL_CONTAINER_DISK` MB).

If `check_terminal_requirements()` returns `False`, Hermes strips the terminal **and**
file tools from the agent's toolset entirely.

### Environment variables

| Variable | Read by | Purpose |
|---|---|---|
| `TENKI_API_KEY` | SDK | API key (`tk_...`) |
| `TENKI_AUTH_TOKEN` | SDK | Alternative to the API key; either satisfies the gate |
| `TENKI_PROJECT_ID` | **Hermes**, not the SDK | Only needed when the credential maps to >1 project |
| `TERMINAL_ENV` | Hermes | Overrides `terminal.backend` |
| `TERMINAL_TENKI_IMAGE` | Hermes | Maps to `terminal.tenki_image` |

With multiple projects and no `TENKI_PROJECT_ID`, `_resolve_project_id()` raises a
`ValueError` listing the available `name=pid` pairs.

---

## A note on credentials in the sandbox

`TenkiEnvironment.__init__` runs `FileSyncManager.sync(force=True)`, which enumerates
your host Hermes home (credentials, skills, cache) and uploads it into the sandbox.
That is intentional product behavior — it is how the agent inside the sandbox gets your
API keys.

For a cookbook run that is surprising, so `hermes_env.py` points `HERMES_HOME` at an
empty temp dir before constructing the environment. On a clean machine the sync is a
no-op either way; on a machine with Hermes installed this stops `~/.hermes/auth.json`
from being shipped to a cloud VM. Set `HERMES_KEEP_REAL_HOME=1` to exercise the real
credential sync.

---

## Dependencies

The backend does **not** need the full Hermes app — no database, no gateway, no model
provider, no agent loop. Three packages cover the whole import chain:

```
tenki-sandbox==0.4.0    # the SDK
PyYAML>=6.0             # tools.credential_files -> hermes_cli.config
requests>=2.31          # tools.terminal_tool -> tools.environments.managed_modal
```

It does still need the Hermes **source tree** on `sys.path`, which is why `setup.sh`
clones it.

---

## Files

| File | Purpose |
|---|---|
| `setup.sh` | Clone the PR branch, repin the SDK to a published version |
| `requirements.txt` | The three real deps, with the pin discrepancy documented |
| `hermes_env.py` | `sys.path` + `HERMES_HOME` bootstrap, SDK-level teardown helper |
| `main.py` | Narrated walkthrough of the backend contract |
| `verify.py` | 19 assertions against live Tenki; non-zero exit on any mismatch |

## Verification status

**Run green against live Tenki (2026-07-28), `tenki-sandbox==0.4.0`.**

- `verify.py` → **19/19 checks pass** on a real account: sandbox boot, cwd/home
  resolution, exit-code propagation, stderr surfacing, cross-`execute()` cwd tracking,
  file write/read on the guest, stdin (heredoc), and a full **pause → reattach → resume**
  persistence roundtrip (same sandbox id). Both sandboxes terminate at the end (`closed`).
- `main.py` → runs the narrated walkthrough end-to-end and tears down (`closed 1
  sandbox(es)`), including the reattach path.
- **One live-only finding, now baked into check 8:** heredoc-mode stdin is *not*
  byte-exact. The backend embeds stdin as a shell heredoc, which always appends a
  trailing newline, so an 18-byte payload lands as 19 bytes on the guest. Content is
  intact; only the byte count differs by one. This is inherent to heredoc stdin and
  shared by every heredoc backend (Modal, Daytona), not a Tenki quirk — check 8 now
  asserts `len(payload) + 1` and explains why.

Also confirmed while building:

- The full import chain works with only those three deps; the PR's own mocked suite,
  `tests/tools/test_tenki_environment.py`, passes **39/39**.
- `tenki-sandbox==0.3.1` returns HTTP 404 from PyPI; `0.4.0` returns 200. `setup.sh`
  repins to `0.4.0`, which clears the lazy-deps failure and reaches the live API.

**Caveat:** this drives the backend from the **open** PR branch (#1), not a merged
release. When the PR lands (and repins the SDK off `0.3.1`), drop `setup.sh`'s repin step.
