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
The highest-value, fully self-contained next examples — no unpublished deps, big audiences:

| # | Example | Why | Template |
|---|---|---|---|
| 1 | **LangChain code interpreter (Python)** | LangChain's biggest audience is Python; mirror the JS one | `langchain-code-interpreter` (port to Python) |
| 2 | **CrewAI + Tenki** | Popular multi-agent framework; a crew that runs code in a sandbox | `langchain-code-interpreter` |
| 3 | **smolagents + Tenki** | HuggingFace `CodeAgent` with a Tenki executor; high reach | `langchain-code-interpreter` |
| 4 | **E2B → Tenki migration guide** | Arms the Startup-Program switcher pitch; side-by-side code | `run-code-in-a-sandbox` |
| 5 | **Give Claude / Cursor a Tenki sandbox (MCP)** | The broadest integration — any MCP agent | ✅ shipped → `mcp-tenki-sandbox` |
| 6 | **Runners quickstart** | The one-line CI swap; a sample workflow file | new (docs + workflow) |

## Full backlog

### Product quickstarts
| Example | What it shows | Template | Status |
|---|---|---|---|
| Run code in a sandbox | Boot → run → output → dispose (the core loop) | — | ✅ |
| Files in a sandbox | read / write / list / upload / download | `run-code-in-a-sandbox` | 📋 |
| Expose a port / preview URL | Run a web server in a sandbox, get a public URL | `run-code-in-a-sandbox` | 📋 |
| Snapshots & pause/resume | Save state, resume a sandbox later | `run-code-in-a-sandbox` | 📋 |
| Runners quickstart | One-line `runs-on:` swap, sample workflow | new | 🔜 |
| Build a sandbox template in CI | GitHub Action builds `.tenki/template.json` — **official `TenkiCloud/actions` exists** | new | 🔜 |
| Code Reviewer quickstart | Add AI review to a repo; what a review looks like | new | 📋 |

### Framework cookbooks
*Each is that framework's idiomatic "run code in a sandbox" (a tool or backend). Mirrors a row on the be-the-backend list.*

| Framework | What it shows | Template | Status |
|---|---|---|---|
| LangChain (JS) | Code-interpreter agent | — | ✅ |
| LangChain (Python) | Same, Python | `langchain-code-interpreter` | 🔜 |
| CrewAI | Crew with a Tenki code tool | `langchain-code-interpreter` | 🔜 |
| **Composio** | Agent with Tenki sandbox tools (official `@tenkicloud/composio-tools`) | — | ✅ `composio-tenki` |
| smolagents | `CodeAgent` with a Tenki executor | `langchain-code-interpreter` | 🔜 |
| OpenAI Agents SDK | Code-execution tool | `langchain-code-interpreter` | 📋 |
| Vercel Eve | Tenki sandbox backend | — | ✅ |
| Pydantic AI · LlamaIndex · AutoGen · Google ADK | Code tool per framework | `langchain-code-interpreter` | 📋 |

### Migration guides
*"Here's your E2B/Modal/Daytona code, here's the Tenki equivalent" + a mapping table + the switcher pitch. Feeds the Startup-Program switcher campaign.*

| Guide | Template | Status |
|---|---|---|
| E2B → Tenki | `run-code-in-a-sandbox` | 🔜 |
| Modal → Tenki | `run-code-in-a-sandbox` | 📋 |
| Daytona → Tenki | `run-code-in-a-sandbox` | 📋 |

### Use-cases (bigger, multi-step)
| Use-case | What it shows | Template | Status |
|---|---|---|---|
| Build an AI coding agent | write → run → iterate in a sandbox | `langchain-code-interpreter` | 📋 |
| **Covalent workflows on Tenki** | each task/electron in a disposable microVM — **official `covalent-tenki-plugin` exists**, wrap it | `run-code-in-a-sandbox` | 🔜 |
| Batch model-eval | fan out N disposable sandboxes | `run-code-in-a-sandbox` | 📋 |
| CI for AI-generated code | run → test → review (our differentiated opinion) | `run-code-in-a-sandbox` | 📋 |
| Data-analysis agent | code interpreter over a CSV | `langchain-code-interpreter` | 📋 |

### MCP
| Example | What it shows | Status |
|---|---|---|
| Give Claude / Cursor a Tenki sandbox | `tenki-mcp` config + "ask your agent to run code" | ✅ `mcp-tenki-sandbox` |

### Language coverage
| Example | What it shows | Status |
|---|---|---|
| Run code (Python) | The core loop, Python | 🔜 |
| Run code (Go) | The core loop, Go — **official `tenki-sdk-go` exists**, build on it | 📋 |

## Notes & dependencies
- **`langchain-code-interpreter`, `run-code-in-a-sandbox`** use only published packages (LangChain + `@tenkicloud/sandbox`) — self-contained, work today.
- **`eve-agent-on-tenki`** and the **MCP** example install `tenki-eve-sandbox` / `tenki-mcp`, which are on GitHub but **not yet on npm** — those go fully `npm install`-clean (and green in CI) once we publish.
- **`composio-tenki`** installs clean (all three deps — `@composio/core`, `@tenkicloud/composio-tools`, `@anthropic-ai/sdk` — are on npm), but its `verify.mjs` needs **`COMPOSIO_API_KEY`** as a CI secret in addition to the Tenki token. Wire that secret before it goes green.
- **Python examples** need the CI harness extended to run `verify.py` (currently Node-only) — small change to `scripts/run-all.mjs` + the workflow. Flag it in the first Python PR.
- Anything needing the network (`pip install`, scraping) needs `allowOutbound: true` at create — note it in the example.
