# Tenki Cookbook

Runnable examples for building on [Tenki](https://tenki.cloud) — disposable microVM **Sandboxes** for AI agents, drop-in GitHub **Runners**, and an AI **Code Reviewer**.

Each example is small, self-contained, and **actually runs on Tenki** — proven in CI before it merges.

## The one rule

> **Every example ships a `verify.mjs` that exercises it against the live Tenki API and fails loudly if anything breaks. CI runs them all.**

A cookbook with broken examples is worse than no cookbook. This is the bar; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Examples

| Example | What it shows |
|---|---|
| [eve-agent-on-tenki](examples/eve-agent-on-tenki/) | Pin a Vercel **Eve** agent's sandbox to a Tenki microVM in one line |

*(More landing here — framework cookbooks, migration guides, use-cases. See the backlog in CONTRIBUTING.md.)*

## Run an example

```bash
cd examples/eve-agent-on-tenki
npm install
export TENKI_API_KEY=tk_your_key_here   # or: tenki login
node verify.mjs
```

## Verify everything

```bash
npm run verify        # runs every examples/*/verify.mjs
```

## Related

- [tenki-mcp](https://github.com/opencolin/tenki-mcp) — Tenki as an MCP server for any agent
- [tenki-eve-sandbox](https://github.com/opencolin/tenki-eve-sandbox) — Tenki backend for Vercel Eve
- [n8n-nodes-tenki](https://github.com/opencolin/n8n-nodes-tenki) — Tenki as an n8n node

## License

MIT
