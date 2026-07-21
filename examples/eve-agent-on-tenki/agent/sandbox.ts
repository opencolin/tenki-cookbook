// agent/sandbox.ts — pin this agent's sandbox to Tenki.
import { defineSandbox } from "eve/sandbox";
import { tenki } from "tenki-eve-sandbox";

export default defineSandbox({
	backend: tenki({
		// apiKey defaults to TENKI_API_KEY. Tune the microVM if you like:
		// cpuCores: 2,
		// memoryMb: 4096,
		// allowOutbound: true,
		// idleTimeoutMinutes: 10,
	}),
});
