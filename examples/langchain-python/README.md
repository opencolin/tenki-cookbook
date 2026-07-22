# LangChain agent on Tenki — Python (code interpreter)

Give a [LangChain](https://www.langchain.com) **Python** agent a **code interpreter** — a tool that runs Python in a disposable [Tenki](https://tenki.cloud) sandbox and hands the output back. This is the Python port of [`langchain-code-interpreter`](../langchain-code-interpreter/) (the JS one), on the official [`tenki-sandbox`](https://tenki.cloud/docs/sandbox/sdk) SDK. One sandbox per agent session; a `run_python` tool the agent calls to execute code in an isolated microVM.

## The tool (`tenki_tool.py`)

```python
from langchain_core.tools import tool
from tenki_sandbox import Sandbox

def make_code_tool(sandbox: Sandbox):
    @tool
    def run_python(code: str) -> str:
        """Execute Python in a secure, disposable sandbox and return its output."""
        result = sandbox.exec("python3", "-c", code)
        return f"{result.stdout_text}{result.stderr_text}".strip() or f"(exit {result.exit_code})"
    return run_python
```

`exec(command, *args)` passes args straight through (no shell splitting), so multi-line, model-generated code goes across as one `-c` argument with no escaping surprises.

## The agent (`agent.py`)

Create one sandbox, wire the tool into a LangGraph ReAct agent, ask something that needs real computation:

```python
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

with Sandbox.create(**opts) as sandbox:
    agent = create_react_agent(
        ChatOpenAI(model="gpt-4o-mini"),
        tools=[make_code_tool(sandbox)],
    )
    result = agent.invoke(
        {"messages": [{"role": "user", "content": "What is the 20th Fibonacci number? Compute it with Python."}]}
    )
    print(result["messages"][-1].content)
```

## Setup (Python 3.10+)

```bash
uv venv                                   # or: python3.11 -m venv .venv
uv pip install -r requirements.txt        # tenki-sandbox + langchain + langgraph
export TENKI_AUTH_TOKEN=...               # see the auth note below
```

**Auth note.** The Python SDK authenticates cleanly with a **`tk_` API key** (`export TENKI_AUTH_TOKEN=tk_…`). A `tenki login` browser session token also works, but — unlike the Node SDK — the Python SDK won't auto-detect it; pass it as **`cookie:<token>`** so it's sent as a cookie (`verify.py` and `agent.py` do this for you). It's an SDK gap, not yours.

## Verify it (no LLM needed)

```bash
node verify.mjs      # or: .venv/bin/python verify.py
```

`verify.py` builds the tool over a live sandbox and calls it directly (`run_python.invoke({"code": ...})`), asserting the result — proving the Tenki-facing half without a model key. This is what CI runs.

## Run the full agent

```bash
export OPENAI_API_KEY=sk-...
.venv/bin/python agent.py    # a LangChain agent computes an answer using the sandbox
```

## Notes

- **One sandbox per session, reused across tool calls** — cheaper than a sandbox per call; terminated when the `with` block exits.
- Requires **Python 3.10+** (a `tenki-sandbox` requirement); the rest of the cookbook is Node, so this example is verified via the `verify.mjs` → `verify.py` shim.
- Stdlib only by default — sandboxes have no outbound network unless you create them with `allow_outbound` (needed for `pip install`).
- Tenki confines file I/O to `/home/tenki` — write to relative paths.
- Official SDK + full API: [tenki.cloud/docs/sandbox/sdk](https://tenki.cloud/docs/sandbox/sdk). Same tool-backed-by-a-sandbox pattern as the [JS version](../langchain-code-interpreter/).
