# Give Claude or Cursor a Tenki sandbox (MCP)

Point any [MCP](https://modelcontextprotocol.io) client — Claude Desktop, Cursor, Claude Code — at **[`tenki-mcp`](https://github.com/opencolin/tenki-mcp)** and your agent gets a disposable Tenki microVM it can drive natively: create sandboxes, run code, read/write files, run git, expose preview URLs, manage snapshots/volumes/templates. **84 tools**, full parity with the Tenki API.

No SDK code to write — it's a config entry.

## Wire it into your MCP client

Add this to your client's MCP config (Claude Desktop: `claude_desktop_config.json`; Cursor: `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "tenki": {
      "command": "npx",
      "args": ["-y", "tenki-mcp"],
      "env": { "TENKI_API_KEY": "<your Tenki auth token>" }
    }
  }
}
```

Your token is the `auth_token` in `~/.config/tenki/config.yaml` after `tenki login`.

> Until `tenki-mcp` is published to npm, install it from source instead:
> `git clone https://github.com/opencolin/tenki-mcp && cd tenki-mcp && npm install && npm run build`,
> then point `command` at `node` and `args` at the absolute path to `dist/index.js`.

## Try it

Once connected, ask your agent:

> "Run this Python in a fresh Tenki sandbox and tell me what it prints: `print(sum(range(100)))`"

It calls `tenki_run_code`, which boots a microVM, runs the snippet, returns the output, and tears the sandbox down — per-second billed, gone when it's done.

## A few of the 84 tools

| | |
|---|---|
| `tenki_run_code` | one-shot: boot → run shell/python/js → dispose |
| `tenki_create_sandbox` / `tenki_exec` | a persistent sandbox + run commands in it |
| `tenki_read_file` / `tenki_write_file` | filesystem I/O |
| `tenki_git` | clone / commit / push inside the sandbox |
| `tenki_create_preview_url` | a public URL for a server the agent starts |
| `tenki_create_snapshot` / `tenki_create_volume` | checkpoint state / attach a persistent disk |

Full list: the [tenki-mcp README](https://github.com/opencolin/tenki-mcp#tools).

## Verify

`verify.mjs` proves the whole path end-to-end the way an MCP client does: it spawns the server, lists its tools, and calls `tenki_run_code` to run Python in a **real microVM**, asserting the output.

```bash
npm install
node verify.mjs        # needs TENKI_API_KEY (or `tenki login`)
# → ✓ connected — 84 tools advertised
# → ✓ tools/list → tenki_run_code (python) → "42" in a live microVM
```
