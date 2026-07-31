/**
 * Shim so the cookbook's Node verify harness can run this Python example.
 *
 * The Tenki terminal backend lives ONLY on an open PR branch (it is not a
 * published package), so this first runs setup.sh -- which clones the public
 * fork LuxorLabs/tenki-hermes-agent, checks out PR #1 into ./hermes-agent, and
 * repins the SDK to a version that exists on PyPI -- then runs verify.py.
 *
 * CI already `pip install`s requirements.txt (the SDK + deps) into its Python
 * before this runs. verify.py drives the real backend against live Tenki and
 * exits non-zero on any failure.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// 1. Check out the PR-branch backend if it isn't already present (idempotent).
if (!existsSync("hermes-agent/tools/environments/tenki.py")) {
  const s = spawnSync("bash", ["setup.sh", "hermes-agent"], { stdio: "inherit" });
  if (s.status !== 0) process.exit(s.status ?? 1);
}

// 2. Run the Python verification against live Tenki. Prefer a local venv if the
//    reader made one; otherwise use the ambient python (what CI installs into).
const py = existsSync(".venv/bin/python") ? ".venv/bin/python" : process.env.PYTHON || "python3";
const r = spawnSync(py, ["verify.py"], { stdio: "inherit" });
process.exit(r.status ?? 1);
