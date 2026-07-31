#!/usr/bin/env bash
# Fetch the Hermes branch that carries the Tenki terminal backend.
#
# tools/environments/tenki.py exists ONLY on the open PR branch -- it is not on
# any default branch and it is not a published package. See README.md.
set -euo pipefail

DEST="${1:-hermes-agent}"

# LuxorLabs/tenki-hermes-agent#1 is the original PR (fork of NousResearch/hermes-agent).
# NousResearch/hermes-agent#64190 is the same backend proposed upstream.
REPO="${HERMES_UPSTREAM:-https://github.com/LuxorLabs/tenki-hermes-agent.git}"
PR="${HERMES_PR:-1}"

if [ -d "$DEST/.git" ]; then
  echo "==> $DEST already exists, reusing it"
else
  echo "==> Cloning $REPO"
  git clone --depth 1 "$REPO" "$DEST"
fi

cd "$DEST"
echo "==> Fetching PR #$PR"
git fetch --depth 1 origin "pull/$PR/head:tenki-backend" 2>/dev/null || \
  git fetch origin "pull/$PR/head:tenki-backend"
git checkout tenki-backend

if [ ! -f tools/environments/tenki.py ]; then
  echo "ERROR: tools/environments/tenki.py missing after checkout." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Repin tenki-sandbox to a version that exists on PyPI.
#
# The PR pins tenki-sandbox==0.3.1 in BOTH tools/lazy_deps.py and pyproject.toml,
# but 0.3.1 was never published (PyPI 404; published: 0.1.0 0.1.1 0.3.5 0.3.6 0.4.0).
#
# This is not cosmetic. TenkiEnvironment.__init__ calls
# lazy_deps.ensure("terminal.tenki", prompt=False) before importing the SDK.
# Whenever `packaging` is importable (any normal install), ensure() compares the
# INSTALLED version against the pin, so even with a good tenki-sandbox already
# installed the pin is "unsatisfied" -> it shells out to pip -> 404 ->
# FeatureUnavailable -> ImportError, and the backend cannot start until the pin
# moves. (Without `packaging` it falls back to a presence check and passes.)
# Upstream fix: bump the pin in the PR.
# ---------------------------------------------------------------------------
PIN="${TENKI_SDK_VERSION:-0.4.0}"
if grep -q 'tenki-sandbox==0.3.1' tools/lazy_deps.py pyproject.toml 2>/dev/null; then
  echo "==> Repinning tenki-sandbox 0.3.1 -> $PIN (0.3.1 is not on PyPI)"
  sed -i.bak "s/tenki-sandbox==0\.3\.1/tenki-sandbox==$PIN/g" \
    tools/lazy_deps.py pyproject.toml
  rm -f tools/lazy_deps.py.bak pyproject.toml.bak
fi

echo
echo "==> OK. Backend at $(pwd)/tools/environments/tenki.py"
echo "    Now: pip install -r requirements.txt && python verify.py"
