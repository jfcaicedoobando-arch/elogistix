/**
 * 13.116.0 — Reemplaza tests de grep por checks de seguridad estructural.
 *
 * `demo-access` usa SERVICE_ROLE para crear/resetear el usuario demo. Si
 * alguno de estos checks falla, podríamos estar exponiendo admin a usuarios
 * sin auth, o cambiando el contrato del email demo y rompiendo el portal.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("demo-access: maneja preflight CORS antes que cualquier lógica", () => {
  assertStringIncludes(indexSource, 'req.method === "OPTIONS"');
  // CORS estricto compartido (política del proyecto: no wildcard).
  assertStringIncludes(indexSource, 'from "../_shared/cors.ts"');
  assertStringIncludes(indexSource, "corsHeaders");
});

Deno.test("demo-access: usa service role key con persistSession=false", () => {
  // Persistir sesión con service role en edge function = leak de privilegios.
  assertStringIncludes(indexSource, "SUPABASE_SERVICE_ROLE_KEY");
  assertStringIncludes(indexSource, "persistSession: false");
  assertStringIncludes(indexSource, "autoRefreshToken: false");
});

Deno.test("demo-access: invoca RPCs de provisión (membership + seed)", () => {
  // Si se quitan, la cuenta demo entra pero ve datos vacíos o ajenos.
  assertStringIncludes(indexSource, "ensure_demo_membership");
  assertStringIncludes(indexSource, "seed_demo_organization");
});

Deno.test("demo-access: contrato del email demo (no regresión silenciosa)", () => {
  assertEquals(
    indexSource.match(/DEMO_EMAIL\s*=\s*"([^"]+)"/)?.[1],
    "demo@librecarga.com",
  );
});

Deno.test("demo-access: captura excepciones con Sentry (no se pierden errores)", () => {
  assertStringIncludes(indexSource, "captureEdgeException");
});
