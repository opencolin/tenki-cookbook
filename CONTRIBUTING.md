# Contributing to the Tenki Cookbook

This repo is the examples/cookbook layer for Tenki. If you're the person maintaining it, this is your playbook.

## The bar (non-negotiable)

**Every example must run on Tenki and prove it in CI.** No exceptions. A public example that doesn't work damages the brand more than a missing one helps it. The mechanism:

- Each example directory ships a **`verify.mjs`** that exercises the example against the live Tenki API and **exits non-zero if anything fails**.
- CI runs every `verify.mjs` (see `.github/workflows/verify.yml`) with a `TENKI_API_KEY` secret. A red build blocks the merge.

## Anatomy of an example

```
examples/<name>/
  README.md        # the tutorial — what it does, the whole integration, how to run
  package.json     # deps (type: module)
  verify.mjs       # CI-runnable proof it works against Tenki
  <code>           # the actual example (agent/, src/, a script, …)
```

`verify.mjs` reads the token from `TENKI_API_KEY` (CI) or `~/.config/tenki/config.yaml` (local `tenki login`), drives the Tenki-facing code, asserts the result, and cleans up (terminate any sandbox it created). Keep it under ~60 lines.

## Style

- **Short and runnable beats comprehensive.** One clear thing per example.
- Every example README links back to `tenki.cloud` and names the products it uses.
- Tenki confines file I/O to `/home/tenki` — use relative paths in examples.
- The example is the canonical code; the companion blog article is the walkthrough.

## The backlog (ranked)

1. **Product quickstarts** — Sandbox · Runners · Code Reviewer.
2. **Framework cookbooks** — Eve (done, the template) · LangChain · CrewAI · smolagents · OpenAI Agents SDK. Each mirrors a row on the be-the-backend integration list.
3. **Migration guides** — E2B → Tenki · Modal → Tenki · Daytona → Tenki (feeds the Startup Program switcher campaign).
4. **Use-cases** — build an AI coding agent · batch-eval a model in disposable sandboxes · CI for AI-generated code (run → test → review).
5. **MCP** — give Claude / Cursor a Tenki sandbox.

## Flow

Draft → Colin reviews (+ an engineer spot-checks accuracy) → publish. Pull the next item off the backlog and ship it.
