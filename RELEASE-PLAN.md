# Cookbook release plan → v2

Milestones from [ROADMAP.md](ROADMAP.md), grouped into releases. A PM council (reach / effort / strategic-fit lenses) reviews and refines this; `STATE.md` tracks live progress. The bar is unchanged: **every example runs on Tenki and proves it in `verify.mjs` (CI-gated).**

## v0.6 — self-contained quickstarts ✅ SHIPPED (Jul 21)
JS + the official `@tenkicloud/sandbox` npm SDK + the Tenki token. Built by a worktree-builder fan-out, each **verified end-to-end against live Tenki** (re-run independently before merge).
- ✅ `files-in-a-sandbox` — write → read back → list
- ✅ `expose-a-port` — web server → `exposePort` → public preview URL (host GET 200 confirmed)
- ✅ `snapshots-pause-resume` — create → write → pause/snapshot → resume → marker survived
- ✅ `e2b-to-tenki-migration` — side-by-side E2B↔Tenki + a mapping table (feeds the Startup-Program switcher pitch)

## v0.7 — top framework cookbooks
- ⭐ `vercel-ai-sdk` — Tenki as the AI SDK's `experimental_sandbox` (reuses `tenki-eve-sandbox`'s session interface). *Dep: publish/inline the session impl.*
- `smolagents` — a Tenki executor mirroring `remote_executors.py` (E2B/Docker). *Python.*
- `crewai` — a crew with a Tenki code tool. *Python.*
- `langchain-python` — port the JS code-interpreter to Python. *Python.*
- *Blocker to clear first: the CI harness runs Node `verify.mjs` only — add `verify.py` support (small change to `scripts/run-all.mjs` + the workflow).*

## v0.8 — more frameworks + migrations
- `autogen-ag2` (Tenki `CommandLineCodeExecutor`) · `openai-agents-sdk` · `llamaindex` · `pydantic-ai` · `google-adk`
- `modal-to-tenki` · `daytona-to-tenki` migration guides

## v0.9 — use-cases (multi-step, showcase the "run→test→review" opinion)
- `coding-agent` (write → run → iterate) · `data-analysis-agent` (CSV code-interpreter) · `batch-model-eval` (fan out N disposable sandboxes) · `ci-for-ai-code` (run → test → review) · `jupyter-papermill` (data-science lane) · `covalent-workflows` (wrap the official plugin)

## v1.0 — "the complete cookbook"
- All v0.6–v0.9 examples shipped and green in CI (deps published, Python harness live).
- Companion articles for the top ~6 examples.
- README + ROADMAP reflect a full matrix; first-party integrations (Composio/Covalent/Actions/Go SDK) cross-linked.

## v2.0 — depth
- `openhands-runtime` — a Tenki `Runtime` for the 81.6k★ coding agent (bigger lift).
- Language coverage: `run-code-go` (on `tenki-sdk-go`), `run-code-python`.
- Streaming/interactive examples once `tenki-mcp` v2 (streaming transport) lands.
- Cross-link the `built-on-tenki` showcase (real ported apps).

## How releases map to work
Each example = one worktree-isolated builder (create `examples/<name>/` per `CONTRIBUTING.md`, verify against live Tenki, return files + result). v0.6 is buildable autonomously now; v0.7+ gate on the Python harness and dep-publishing noted above.
