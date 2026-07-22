# Cookbook roadmap

The backlog of examples, ranked and categorized. Pick the next thing off **Start here**, or grab anything below. Every example is also a companion article (the example is the canonical code; the article is the walkthrough).

**Before you start:** read [CONTRIBUTING.md](CONTRIBUTING.md) — setup, the anatomy of an example, and the one rule (**every example runs on Tenki and proves it in `verify.mjs`, which CI gates on**).

## Legend
- ✅ done · 🔜 next (self-contained, build now) · 📋 backlog
- **Template** = the shipped example to copy the pattern from:
  - `run-code-in-a-sandbox` — direct SDK use (`@tenkicloud/sandbox`)
  - `langchain-code-interpreter` — a framework agent + a code-execution tool
  - `eve-agent-on-tenki` — a pluggable sandbox backend for a framework

## Start here (recommended order)
The highest-value next examples. Ranked by reach × fit × effort (validated Jul 21 — see [Sourcing note](#sourcing-note-jul-21)).

| # | Example | Why | Template |
|---|---|---|---|
| 1 | **⭐ Vercel AI SDK + Tenki** | 25.7k★ — THE TypeScript AI toolkit. Its `experimental_sandbox` wants the **same run/spawn/file interface `tenki-eve-sandbox` already implements** → a thin adapter, not a rebuild. Biggest reach, least new code. | `eve-agent-on-tenki` (same interface) |
| 2 | **LangChain code interpreter (Python)** | LangChain's biggest audience is Python; mirror the JS one | `langchain-code-interpreter` (port to Python) |
| ~~3~~ | ~~**smolagents + Tenki**~~ | ✅ **shipped** → `smolagents` (a Tenki `RemotePythonExecutor` on the `remote_executors.py` seam) | done |
| ~~4~~ | ~~**CrewAI + Tenki**~~ | ✅ **shipped** → `crewai-code-interpreter` (55.9k★; a crew that runs code in a Tenki sandbox) | done |
| 5 | **E2B → Tenki migration guide** | Arms the Startup-Program switcher pitch; side-by-side code | `run-code-in-a-sandbox` |
| 6 | **Runners quickstart** | The one-line CI swap; a sample workflow file | new (docs + workflow) |
| 7 | **OpenHands runtime (bigger lift)** | 81.6k★ — the open coding agent. A Tenki Runtime alongside its Docker/E2B/Daytona/Modal. Highest reach of all, but real work (Python runtime impl). | new |

## Full backlog

### Product quickstarts
| Example | What it shows | Template | Status |
|---|---|---|---|
| Run code in a sandbox | Boot → run → output → dispose (the core loop) | — | ✅ |
| Files in a sandbox | read / write / list | — | ✅ `files-in-a-sandbox` |
| Expose a port / preview URL | Run a web server in a sandbox, get a public URL | — | ✅ `expose-a-port` |
| Snapshots & pause/resume | Save state, resume a sandbox later | — | ✅ `snapshots-pause-resume` |
| Runners quickstart | One-line `runs-on:` swap, sample workflow | new | 🔜 |
| Build a sandbox template in CI | GitHub Action builds `.tenki/template.json` — **official `TenkiCloud/actions` exists** | new | 🔜 |
| Code Reviewer quickstart | Add AI review to a repo; what a review looks like | new | 📋 |

### Framework cookbooks
*Each is that framework's idiomatic "run code in a sandbox" (a tool or backend). Mirrors a row on the be-the-backend list.*

| Framework | Stars | What it shows | Template | Status |
|---|---|---|---|---|
| **⭐ Vercel AI SDK** | 25.7k | Tenki as the AI SDK's `experimental_sandbox` — the model's tools run in a microVM | — | ✅ `vercel-ai-sdk` |
| LangChain (JS) | 15k+ | Code-interpreter agent | — | ✅ |
| LangChain (Python) | 100k+ | Same, Python | — | ✅ `langchain-python` |
| smolagents | 28.5k | `CodeAgent` + a Tenki executor (`remote_executors.py` seam) | — | ✅ `smolagents` |
| CrewAI | 55.9k | Crew with a Tenki code tool | — | ✅ `crewai-code-interpreter` |
| **OpenHands** | 81.6k | A Tenki **Runtime** (its backends: Docker/E2B/Daytona/Modal/Remote) — the open coding agent | new | 📋 big |
| **Composio** | — | Agent with Tenki sandbox tools (official `@tenkicloud/composio-tools`) | — | ✅ `composio-tenki` |
| OpenAI Agents SDK | 15k+ | Code-execution tool | — | ✅ `openai-agents-sdk` |
| Vercel Eve | — | Tenki sandbox backend | — | ✅ |
| AutoGen / **ag2** | 60k / 4.8k | A Tenki `CommandLineCodeExecutor` (mirrors their Docker/Jupyter executors) | `langchain-code-interpreter` | 📋 |
| Pydantic AI · LlamaIndex · Google ADK | — | Code tool per framework | `langchain-code-interpreter` | 📋 |

### Migration guides
*"Here's your E2B/Modal/Daytona code, here's the Tenki equivalent" + a mapping table + the switcher pitch. Feeds the Startup-Program switcher campaign.*

| Guide | Template | Status |
|---|---|---|
| E2B → Tenki | — | ✅ `e2b-to-tenki-migration` |
| Modal → Tenki | — | ✅ `modal-to-tenki-migration` |
| Daytona → Tenki | — | ✅ `daytona-to-tenki-migration` |

### Use-cases (bigger, multi-step)
| Use-case | What it shows | Template | Status |
|---|---|---|---|
| Build an AI coding agent | write → run → iterate in a sandbox | `langchain-code-interpreter` | 📋 |
| **Covalent workflows on Tenki** | each task/electron in a disposable microVM (official `covalent-tenki-plugin`) | — | ✅ `covalent-tenki` |
| Batch model-eval | fan out N disposable sandboxes | `run-code-in-a-sandbox` | 📋 |
| CI for AI-generated code | run → test → review (our differentiated opinion) | `run-code-in-a-sandbox` | 📋 |
| Data-analysis agent | code interpreter over a CSV | `langchain-code-interpreter` | 📋 |
| Run a Jupyter notebook | [Papermill](https://github.com/nteract/papermill) (6.5k★) parameterizes + executes a notebook in a disposable sandbox — the data-science on-ramp | `run-code-in-a-sandbox` | 📋 |

### MCP
| Example | What it shows | Status |
|---|---|---|
| Give Claude / Cursor a Tenki sandbox | `tenki-mcp` config + "ask your agent to run code" | ✅ `mcp-tenki-sandbox` |

### Language coverage
| Example | What it shows | Status |
|---|---|---|
| Run code (Python) | The core loop, Python — official `tenki-sandbox` PyPI SDK | ✅ `run-code-python` |
| Run code (Go) | The core loop, Go — **official `tenki-sdk-go` exists**, build on it | 📋 |

## Sourcing note (Jul 21)
How candidates get onto this list — and how they get rejected:

- **The fit test first:** does the project's agent *write/run code* that benefits from a disposable microVM? If it only calls APIs (payments, CRM, email), a sandbox adds nothing — skip it. (This is why a batch of Hermes *business*-hackathon winners was rejected — see `built-on-tenki`.)
- **Then validate the seam + reach** (don't add names on faith): confirm the framework has a real executor/sandbox plug-point, and check stars/recency. Findings this round:
  - **⭐ Vercel AI SDK** (25.7k★, pushed daily) — the highest-leverage add we were missing. Its `experimental_sandbox` takes the *same* run/spawn/file interface `tenki-eve-sandbox` already implements → most reach, least new code. **Build next.**
  - **OpenHands** (81.6k★) — the biggest open coding agent; a pluggable `Runtime`. Highest ceiling, bigger lift.
  - **smolagents** (28.5k★) — `remote_executors.py` (E2B/Docker) confirmed as the seam; small PR.
  - **CrewAI** (55.9k★), **AutoGen/ag2** (60k★ brand) — real code-executor seams.
  - **Papermill** (6.5k★) — opens the data-science/notebook lane.
- **Rejected / low-priority:** Aider (47.6k★ but runs locally — no clean pluggable-sandbox seam) · Qwen-Agent (has a code interpreter but ~4 months stale). Reach without a seam ≠ a good example.

## Notes & dependencies
- **`langchain-code-interpreter`, `run-code-in-a-sandbox`** use only published packages (LangChain + `@tenkicloud/sandbox`) — self-contained, work today.
- **`eve-agent-on-tenki`** and the **MCP** example install `tenki-eve-sandbox` / `tenki-mcp`, which are on GitHub but **not yet on npm** — those go fully `npm install`-clean (and green in CI) once we publish.
- **`composio-tenki`** installs clean (all three deps — `@composio/core`, `@tenkicloud/composio-tools`, `@anthropic-ai/sdk` — are on npm), but its `verify.mjs` needs **`COMPOSIO_API_KEY`** as a CI secret in addition to the Tenki token. Wire that secret before it goes green.
- **Python examples** need the CI harness extended to run `verify.py` (currently Node-only) — small change to `scripts/run-all.mjs` + the workflow. Flag it in the first Python PR.
- Anything needing the network (`pip install`, scraping) needs `allowOutbound: true` at create — note it in the example.
