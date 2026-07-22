# Cookbook release plan → v2

Milestones from [ROADMAP.md](ROADMAP.md), grouped into releases. A PM council (reach / effort / strategic-fit lenses) reviews and refines this; `STATE.md` tracks live progress. The bar is unchanged: **every example runs on Tenki and proves it in `verify.mjs` (CI-gated).**

## v0.6 — self-contained quickstarts ✅ SHIPPED (Jul 21)
JS + the official `@tenkicloud/sandbox` npm SDK + the Tenki token. Built by a worktree-builder fan-out, each **verified end-to-end against live Tenki** (re-run independently before merge).
- ✅ `files-in-a-sandbox` — write → read back → list
- ✅ `expose-a-port` — web server → `exposePort` → public preview URL (host GET 200 confirmed)
- ✅ `snapshots-pause-resume` — create → write → pause/snapshot → resume → marker survived
- ✅ `e2b-to-tenki-migration` — side-by-side E2B↔Tenki + a mapping table (feeds the Startup-Program switcher pitch)

## v0.7 — top framework cookbooks + Python on-ramp (mostly SHIPPED Jul 21)
- ✅ ⭐ `vercel-ai-sdk` — a self-contained adapter making a Tenki sandbox satisfy the AI SDK's `experimental_sandbox` (built directly on `@tenkicloud/sandbox`, no eve dep). Verified against live Tenki (no LLM key).
- ✅ `run-code-python` — the core loop in Python via the official **`tenki-sandbox` PyPI SDK**. **This cleared the "Python on-ramp" blocker:** Python examples ship a `verify.mjs` shim that runs `verify.py`, so the Node CI harness runs them unchanged.
- ✅ `langchain-python` — LangChain (Python) agent with a Tenki code tool. Verified live.
- 🔜 `smolagents` — a Tenki executor mirroring `remote_executors.py` (now unblocked by the Python on-ramp).

## v0.8 — more frameworks + migrations (partly SHIPPED Jul 21)
- ✅ `smolagents` — a Tenki `RemotePythonExecutor` (stateful, via a tiny in-sandbox kernel). Verified live.
- ✅ `openai-agents-sdk` — agent tool that runs code in a Tenki sandbox. Verified live.
- ✅ `modal-to-tenki-migration` · ✅ `daytona-to-tenki-migration` — the E2B guide cloned for Modal/Daytona. Verified live.
- 🔜 remaining: `autogen-ag2` (Tenki `CommandLineCodeExecutor`) · `llamaindex` · `pydantic-ai` · `google-adk`.

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
