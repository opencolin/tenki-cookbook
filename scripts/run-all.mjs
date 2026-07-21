/**
 * Runs every examples/<name>/verify.mjs and reports pass/fail.
 * Exit non-zero if any example fails — this is what CI gates on.
 * (Assumes each example's deps are installed; CI installs per-example first.)
 */
import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const examplesDir = join(root, "examples");

const names = readdirSync(examplesDir, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name);

let failed = 0;
for (const name of names) {
	const verify = join(examplesDir, name, "verify.mjs");
	if (!existsSync(verify)) {
		console.log(`- ${name}: no verify.mjs (skipped)`);
		continue;
	}
	console.log(`\n=== ${name} ===`);
	const r = spawnSync("node", [verify], { cwd: join(examplesDir, name), stdio: "inherit" });
	if (r.status !== 0) {
		failed++;
		console.log(`  FAILED: ${name}`);
	}
}

console.log(`\n${failed ? `✗ ${failed} example(s) failed` : "✓ all examples passed"}`);
process.exit(failed ? 1 : 0);
