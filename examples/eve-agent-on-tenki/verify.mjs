/**
 * Proves this example works: drives the Tenki backend exactly as Eve's runtime
 * does — create → run → file round-trip → shutdown — against a live microVM,
 * then cleans up. Token from TENKI_API_KEY (CI) or ~/.config/tenki/config.yaml
 * (local `tenki login`). Exits non-zero on any failure.
 */
import { tenki, TenkiClient } from "tenki-eve-sandbox";
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

const backend = tenki({ apiKey: token });
let sessionId;
try {
	const handle = await backend.create({
		templateKey: null,
		sessionKey: "cookbook-eve",
		runtimeContext: { appRoot: process.cwd() },
	});
	sessionId = (await handle.captureState()).metadata.sessionId;

	const r = await handle.session.run({ command: "echo hello-from-the-cookbook; python3 -c 'print(6*7)'" });
	if (!(r.exitCode === 0 && r.stdout.includes("hello-from-the-cookbook") && r.stdout.includes("42"))) {
		throw new Error(`run returned unexpected result: ${JSON.stringify(r)}`);
	}

	await handle.session.writeTextFile({ path: "note.txt", content: "written by the eve example" });
	const back = await handle.session.readTextFile({ path: "note.txt" });
	if (back !== "written by the eve example") throw new Error(`file round-trip mismatch: ${JSON.stringify(back)}`);

	await handle.shutdown();
	console.log("✓ eve-agent-on-tenki: create → run (42) → file round-trip → shutdown");
} catch (e) {
	console.error(`✗ ${e?.message ?? e}`);
	process.exitCode = 1;
} finally {
	if (sessionId) {
		try {
			await new TenkiClient(token).control("TerminateSession", { sessionId });
		} catch {
			/* self-reaps via idle/lifetime caps */
		}
	}
}
