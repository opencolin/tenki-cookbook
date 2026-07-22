# Tenki Cookbook

Runnable examples for building on [Tenki](https://tenki.cloud) — disposable microVM **Sandboxes** for AI agents, drop-in GitHub **Runners**, and an AI **Code Reviewer**.

Each example is small, self-contained, and **actually runs on Tenki** — proven in CI before it merges.

## The one rule

> **Every example ships a `verify.mjs` that exercises it against the live Tenki API and fails loudly if anything breaks. CI runs them all.**

A cookbook with broken examples is worse than no cookbook. This is the bar; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Examples

| Example | What it shows |
|---|---|
| [run-code-in-a-sandbox](examples/run-code-in-a-sandbox/) | Boot a disposable microVM, run code, get the output, tear it down — the core loop |
| [files-in-a-sandbox](examples/files-in-a-sandbox/) | Write, read back, and list files in a sandbox with the official SDK |
| [expose-a-port](examples/expose-a-port/) | Run a web server in a sandbox and get a public preview URL |
| [snapshots-pause-resume](examples/snapshots-pause-resume/) | Snapshot / pause a sandbox and resume it with state intact |
| [e2b-to-tenki-migration](examples/e2b-to-tenki-migration/) | Moving from E2B → Tenki: side-by-side code + an API mapping table |
| [langchain-code-interpreter](examples/langchain-code-interpreter/) | A LangChain agent that writes and runs code in a Tenki sandbox |
| [crewai-code-interpreter](examples/crewai-code-interpreter/) | A CrewAI agent (Python) that runs code in a Tenki sandbox |
| [eve-agent-on-tenki](examples/eve-agent-on-tenki/) | Run a Vercel Eve agent's sandbox on Tenki |
| [mcp-tenki-sandbox](examples/mcp-tenki-sandbox/) | Give Claude / Cursor a Tenki sandbox via the `tenki-mcp` MCP server (84 tools) |
| [composio-tenki](examples/composio-tenki/) | A Composio agent that runs code in a Tenki sandbox, via the official `@tenkicloud/composio-tools` toolkit |
| [covalent-tenki](examples/covalent-tenki/) | A Covalent workflow where each task runs in its own Tenki microVM, via the official `covalent-tenki-plugin` |

*(More landing here — more framework cookbooks (Vercel AI SDK, smolagents), migration guides, use-cases. See the backlog in [CONTRIBUTING.md](CONTRIBUTING.md).)*

## Benchmarks

Standard coding benchmarks, run on Tenki microVMs and graded with each benchmark's **official** harness — so scores are comparable, not a lookalike. Heavier than the examples (real eval images), same one rule (a no-model-key `verify.mjs` in CI). See [benchmarks/](benchmarks/).

| Benchmark | What it measures |
|---|---|
| [swe-bench](benchmarks/swe-bench/) | Fix a real GitHub issue so the repo's hidden tests pass — SWE-bench Lite / Verified / full, official images + grading, Docker-in-microVM |

## Official integrations

First-party Tenki integrations that ship as their own packages on [github.com/tenkicloud](https://github.com/tenkicloud) — install and use them directly:

| Integration | Install | What it does |
|---|---|---|
| [Composio tools](https://github.com/TenkiCloud/composio-tools) | `npm i @tenkicloud/composio-tools` | Gives any [Composio](https://composio.dev) agent Tenki sandbox tools (create · exec · snapshot · terminate), in-process — no extra backend |
| [Covalent executor](https://github.com/TenkiCloud/covalent-tenki-plugin) | `pip install covalent-tenki-plugin` | A [Covalent](https://github.com/AgnostiqHQ/covalent) executor that runs each workflow task in a disposable Tenki microVM |
| [GitHub Actions](https://github.com/TenkiCloud/actions) | `uses: TenkiCloud/actions/setup-cli@v1` | First-party Actions: install the `tenki` CLI on a runner, build sandbox templates from `.tenki/template.json` in CI |
| [Go SDK](https://github.com/TenkiCloud/tenki-sdk-go) | `go get github.com/TenkiCloud/tenki-sdk-go/sandbox` | Go client for the Tenki Sandbox API |

*(Walkthrough examples that build on these are on the [ROADMAP](ROADMAP.md).)*

## Run an example

```bash
cd examples/run-code-in-a-sandbox
npm install
export TENKI_AUTH_TOKEN=...   # from `tenki login`
node run.mjs
```

## Verify everything

```bash
npm run verify        # runs every examples/*/verify.mjs
```

## Contributing

New examples welcome. Start with **[CONTRIBUTING.md](CONTRIBUTING.md)** (setup + how to add one) and **[ROADMAP.md](ROADMAP.md)** (the ranked backlog — pick from "Start here"). The one rule: every example runs on Tenki and proves it in CI.

## Related

- [tenki-mcp](https://github.com/opencolin/tenki-mcp) — Tenki as an MCP server for any agent
- [tenki-eve-sandbox](https://github.com/opencolin/tenki-eve-sandbox) — Tenki backend for Vercel Eve
- [n8n-nodes-tenki](https://github.com/opencolin/n8n-nodes-tenki) — Tenki as an n8n node

## License

MIT
