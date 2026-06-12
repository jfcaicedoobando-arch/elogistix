/**
 * Smoke test para demo-access — valida método HTTP + CORS preflight.
 * (No invoca la edge function real; sólo asegura las constantes públicas.)
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("demo-access expone DEMO_EMAIL público", () => {
  assertStringIncludes(indexSource, 'DEMO_EMAIL = "demo@librecarga.com"');
});

Deno.test("demo-access responde a OPTIONS con CORS", () => {
  assertStringIncludes(indexSource, '"Access-Control-Allow-Origin": "*"');
  assertStringIncludes(indexSource, 'req.method === "OPTIONS"');
});

Deno.test("demo-access usa service role key (admin)", () => {
  assertStringIncludes(indexSource, "SUPABASE_SERVICE_ROLE_KEY");
  assertStringIncludes(indexSource, "autoRefreshToken: false");
});

Deno.test("demo-access placeholder check (no regression de email demo)", () => {
  // Si alguien cambia el email demo, este test falla y obliga a actualizar
  // el cliente del portal demo en consecuencia.
  assertEquals(
    indexSource.match(/DEMO_EMAIL\s*=\s*"([^"]+)"/)?.[1],
    "demo@librecarga.com",
  );
});
