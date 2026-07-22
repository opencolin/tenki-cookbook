# Cookbook build state — handoff doc

**Purpose:** any agent can pick up here. Read this + `RELEASE-PLAN.md` + `CONTRIBUTING.md`, then continue.

_Last updated: Jul 21, 2026 (orchestration run kicked off)._

## Where things stand
- **Shipped examples** (in `examples/`, each with a `verify.mjs`): `run-code-in-a-sandbox`, `langchain-code-interpreter`, `crewai-code-interpreter`, `eve-agent-on-tenki`, `mcp-tenki-sandbox`, `composio-tenki`. (README table is the source of truth.)
- **CI harness** (`.github/workflows/verify.yml`): runs each example's `verify.mjs`; now also `pip install -r requirements.txt` + sets up Python 3.12 for Python examples.
- **Release plan:** `RELEASE-PLAN.md` (v0.6 → v2). **Ranked backlog:** `ROADMAP.md`.

## Last orchestration — ✅ COMPLETE (Jul 21)
The `cookbook-buildout` workflow (8 agents, 0 errors) ran:
1. **Council** (3 PM lenses + synthesis) → the v0.6→v2 plan now in `RELEASE-PLAN.md`.
2. **Build** (worktree builders) → **all 4 v0.6 quickstarts shipped**: `files-in-a-sandbox`, `expose-a-port`, `snapshots-pause-resume`, `e2b-to-tenki-migration` — each **re-verified against live Tenki independently before merge** (all PASS), added to `examples/`, README table + `ROADMAP.md` flipped to ✅.

## v0.7 — mostly SHIPPED (Jul 21, second orchestration)
The `cookbook-v07` workflow (3 worktree builders, 0 errors) shipped, each **re-verified against live Tenki independently before merge** (all PASS):
- ✅ `vercel-ai-sdk` — self-contained adapter for the AI SDK's `experimental_sandbox` on `@tenkicloud/sandbox` (no LLM key needed to verify).
- ✅ `run-code-python` — core loop in Python via the **`tenki-sandbox` PyPI SDK**. **Cleared the Python on-ramp:** a `verify.mjs`→`verify.py` shim runs under the existing Node CI harness. Local Python examples need a 3.10+ venv (`uv venv --python 3.12`, then `uv pip install -r requirements.txt` — note: `uv venv` has no pip; use `uv pip`).
- ✅ `langchain-python` — LangChain (Python) agent + Tenki code tool.

## Next up
- **v0.7 remainder:** `smolagents` (now unblocked by the Python on-ramp).
- **v0.8:** Modal/Daytona migrations, AutoGen/ag2, LlamaIndex, Pydantic AI, Google ADK, OpenAI Agents SDK, Runners/Code-Reviewer quickstarts.
- **v0.9:** multi-step use-cases (coding agent, data-analysis, batch-eval, CI-for-AI-code, Papermill).
- **v1.0 — needs Colin:** publish `tenki-eve-sandbox` + `tenki-mcp` to npm (unblocks `eve-agent-on-tenki` + `mcp-tenki-sandbox` CI) and wire `COMPOSIO_API_KEY` as a CI secret. These are the hard external blockers the autonomous loop can't clear.
- **v2.0:** OpenHands runtime, Go, streaming.

## Gotcha log (for builders)
- The live `~/.config/tenki` token is a **session token** (not `tk_`); the **JS** SDK handles it, but the **Python** `tenki-sandbox` SDK needs it sent as a cookie — the shipped Python verifies handle this (prefix `cookie:`). A `tk_` API key works everywhere as-is.
- `exec(cmd, { args })` / `sb.exec("py","-c",code)` do **not** shell-split — route shell syntax through `sh -c`.

## The bar (do not weaken)
Every example ships a `verify.mjs` that runs against **live Tenki** and exits non-zero on failure. Token: `~/.config/tenki/config.yaml` (`auth_token:`) or `TENKI_AUTH_TOKEN`/`TENKI_API_KEY`. Build v0.6 with the official **`@tenkicloud/sandbox`** npm SDK (self-contained). Clean up any sandbox a verify creates.

## Known blockers (clear before the release they gate)
- **v0.7 framework cookbooks (Python):** the Python side of the harness is in; still confirm each Python example's `verify.mjs`→Python path works in CI.
- **`vercel-ai-sdk` + `eve-agent-on-tenki` + `mcp-tenki-sandbox`** depend on `tenki-eve-sandbox` / `tenki-mcp`, **not yet on npm** → green in CI only after those publish (blocked on `npm login`). Locally they verify via the sibling build.
- **Extra secrets:** `composio-tenki`'s verify needs `COMPOSIO_API_KEY` as a CI secret.

## Next actions (for whoever picks up)
1. If the workflow finished: confirm the merged v0.6 examples verify locally, push, tick their status in `ROADMAP.md` + `RELEASE-PLAN.md`, update this file.
2. Then v0.7: build `vercel-ai-sdk` (reuses `tenki-eve-sandbox`'s session interface — highest reach), then `smolagents`.
3. Publish `tenki-eve-sandbox` + `tenki-mcp` to npm (unblocks 3 examples' CI).
