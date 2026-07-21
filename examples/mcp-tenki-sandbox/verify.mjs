/**
 * Proves this example works: spawn the tenki-mcp server, speak MCP to it, list
 * its tools, and call `tenki_run_code` to run Python in a REAL Tenki microVM —
 * asserting the output. Uses the official MCP SDK client (the same way Claude /
 * Cursor drive an MCP server). Token from TENKI_API_KEY (CI) or
 * ~/.config/tenki/config.yaml (local `tenki login`). Exits non-zero on failure.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

function loadToken() {
	if (process.env.TENKI_API_KEY) return process.env.TENKI_API_KEY;
	if (process.env.TENKI_AUTH_TOKEN) return process.env.TENKI_AUTH_TOKEN;
	try {
		const cfg = readFileSync(`${homedir()}/.config/tenki/config.yaml`, "utf8");
		return (cfg.match(/^auth_token:\s*(.+)$/m)?.[1] ?? "").trim();
	} catch {
		return "";
	}
}

const token = loadToken();
if (!token) {
	console.error("No token. Set TENKI_API_KEY, or run `tenki login`.");
	process.exit(1);
}

// Resolve the installed tenki-mcp server entrypoint and spawn it over stdio,
// exactly as an MCP client (Claude Desktop / Cursor) would.
const require = createRequire(import.meta.url);
const serverEntry = require.resolve("tenki-mcp"); // package "main" → dist/index.js

const transport = new StdioClientTransport({
	command: process.execPath, // node
	args: [serverEntry],
	env: { ...process.env, TENKI_API_KEY: token },
});

const client = new Client({ name: "cookbook-verify", version: "1.0.0" });

try {
	await client.connect(transport);

	// 1) The server advertises its tools.
	const { tools } = await client.listTools();
	const names = tools.map((t) => t.name);
	if (!names.includes("tenki_run_code")) throw new Error(`tenki_run_code not advertised (got ${names.length} tools)`);
	console.log(`✓ connected — ${names.length} tools advertised`);

	// 2) Drive a real tool call end-to-end: run Python in a fresh microVM.
	const res = await client.callTool({
		name: "tenki_run_code",
		arguments: { language: "python", code: "print(6 * 7)" },
	});
	const text = res.content?.find((c) => c.type === "text")?.text ?? "";
	const out = JSON.parse(text);
	if (!(out.ok && String(out.stdout).trim() === "42")) {
		throw new Error(`unexpected run_code result: ${JSON.stringify({ stdout: out.stdout, stderr: out.stderr, exitCode: out.exitCode })}`);
	}
	console.log(`✓ mcp-tenki-sandbox: tools/list → tenki_run_code (python) → "42" in a live microVM`);
} catch (e) {
	console.error("✗ " + (e?.message ?? e));
	process.exitCode = 1;
} finally {
	try {
		await client.close();
	} catch {
		/* ignore */
	}
}
