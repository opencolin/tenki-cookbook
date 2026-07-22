# Cookbook build state — handoff doc

**Purpose:** any agent can pick up here. Read this + `RELEASE-PLAN.md` + `CONTRIBUTING.md`, then continue.

_Last updated: Jul 21, 2026 (orchestration run kicked off)._

## Where things stand
- **Shipped examples** (in `examples/`, each with a `verify.mjs`): `run-code-in-a-sandbox`, `langchain-code-interpreter`, `crewai-code-interpreter`, `eve-agent-on-tenki`, `mcp-tenki-sandbox`, `composio-tenki`. (README table is the source of truth.)
- **CI harness** (`.github/workflows/verify.yml`): runs each example's `verify.mjs`; now also `pip install -r requirements.txt` + sets up Python 3.12 for Python examples.
- **Release plan:** `RELEASE-PLAN.md` (v0.6 → v2). **Ranked backlog:** `ROADMAP.md`.

## In flight (this orchestration)
A `cookbook-buildout` workflow is running:
1. **Council** (3 PM subagents: reach / effort / strategic-fit lenses) → reconcile the release plan.
2. **Build** (worktree-isolated builders) → the **v0.6 self-contained quickstarts**: `files-in-a-sandbox`, `expose-a-port`, `snapshots-pause-resume`, `e2b-to-tenki-migration`. Each: create `examples/<name>/` per `CONTRIBUTING.md`, verify against live Tenki, return files + result.
- On completion: merge passing examples into `examples/`, update the README table + `ROADMAP.md` status, commit, and update this file.

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
