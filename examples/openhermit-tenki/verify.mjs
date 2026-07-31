/**
 * Shim so the cookbook's Node verify harness can run this TypeScript example.
 * The real proof is verify.ts; this runs it through tsx (a devDependency that
 * `npm install` provides). Exits with tsx's exit code, so a failed assertion
 * fails the build.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const tsx = existsSync("node_modules/.bin/tsx") ? "node_modules/.bin/tsx" : "tsx";
const r = spawnSync(tsx, ["verify.ts"], { stdio: "inherit" });
process.exit(r.status ?? 1);
