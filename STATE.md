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

## Next up — v0.7 (per the council plan)
`vercel-ai-sdk` (⭐ highest reach — reuses `tenki-eve-sandbox`'s session interface; inline the adapter so it doesn't wait on npm) → `run-code-python` (proves the Python `verify` path) → `langchain-python` → `smolagents`. Then v0.8 broadens the framework/migration matrix; v0.9 is the multi-step use-cases; v1.0 clears the npm-publish + `COMPOSIO_API_KEY` blockers and goes all-green; v2.0 is depth (OpenHands runtime, Go, streaming).

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
