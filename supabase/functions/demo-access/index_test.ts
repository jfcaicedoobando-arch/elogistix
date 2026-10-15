/** Source contracts for the disabled demo release; no account values in fixtures. */
import { doesNotMatch, ok } from "node:assert/strict";

const adapterSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const handlerSource = await Deno.readTextFile(new URL("./handler.ts", import.meta.url));

Deno.test("demo-access: keeps OPTIONS and shared public CORS", () => {
  ok(handlerSource.includes('req.method === "OPTIONS"'));
  ok(handlerSource.includes('from "../_shared/cors.ts"'));
});

Deno.test("demo-access: preserves isolated Supabase client configuration", () => {
  ok(adapterSource.includes("SUPABASE_SERVICE_ROLE_KEY"));
  ok(adapterSource.includes("persistSession: false"));
  ok(adapterSource.includes("autoRefreshToken: false"));
});

Deno.test("demo-access: production adapter supplies neither availability nor credentials", () => {
  doesNotMatch(adapterSource, /\bavailabilityProvider\s*:/);
  doesNotMatch(adapterSource, /\bcredentials\s*:/);
});

Deno.test("demo-access: handler has no literal credential fields or historical constants", () => {
  doesNotMatch(handlerSource, /\b(?:email|password)\s*:\s*["'`]/);
  doesNotMatch(handlerSource, /\bDEMO_(?:EMAIL|PASSWORD)\b/);
});

Deno.test("demo-access: keeps Sentry reporting and existing RPC contracts behind both gates", () => {
  ok(adapterSource.includes("captureEdgeException"));
  ok(handlerSource.includes("ensure_demo_membership"));
  ok(handlerSource.includes("seed_demo_organization_guarded"));
});
