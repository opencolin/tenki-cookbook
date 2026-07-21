# Run your Eve agent on Tenki

Pin a [Vercel Eve](https://vercel.com/eve) agent's sandbox to a Tenki microVM — one line, boot ~2s, per-second billing.

## The whole integration

`agent/sandbox.ts`:

```ts
import { defineSandbox } from "eve/sandbox";
import { tenki } from "tenki-eve-sandbox";

export default defineSandbox({ backend: tenki() });
```

That's it. Your agent's `run`, file I/O, and processes now execute in a Tenki sandbox.

## Run it (in an Eve project)

1. Scaffold an Eve app: `npx eve@latest init my-agent`
2. Drop `agent/sandbox.ts` (and `agent/instructions.md`) in.
3. Install the backend: `npm install tenki-eve-sandbox`
4. `export TENKI_API_KEY=tk_your_key_here`
5. `npx eve dev` — ask the agent to run something; it executes on Tenki.

## Verify the integration (no LLM needed)

```bash
npm install
node verify.mjs        # or: TENKI_API_KEY=tk_... node verify.mjs
```

`verify.mjs` drives the backend exactly as Eve's runtime does — **create → run → file round-trip → shutdown** — against a live Tenki sandbox, and cleans up after itself. This is what CI runs.

## Notes

- Tenki confines file I/O to `/home/tenki`; use **relative paths** (they anchor there).
- Tune the microVM via options: `tenki({ cpuCores: 4, allowOutbound: true, idleTimeoutMinutes: 10 })`.
- Backend + full option list: [tenki-eve-sandbox](https://github.com/opencolin/tenki-eve-sandbox).
