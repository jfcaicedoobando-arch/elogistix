/**
 * 13.149.1 — Guardrails estructurales para `enviar-factura-email`.
 * Sigue el patrón de `demo-access/index_test.ts`: checks sobre el source
 * en lugar de ejecutar la función, para blindar el contrato crítico:
 *  - CORS/preflight antes de cualquier lógica.
 *  - Auth obligatoria (Bearer) y validación mínima del body.
 *  - Uso de SERVICE_ROLE con `persistSession=false`.
 *  - Envoltura Sentry (`wrapEdgeHandler` + `captureEdgeException`).
 *  - Registro del envío en `factura_envios`.
 */
import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url))
  + "\n" + await Deno.readTextFile(new URL("./helpers.ts", import.meta.url));

Deno.test("enviar-factura-email: preflight y CORS", () => {
  assertStringIncludes(indexSource, "handlePreflightStrict");
  assertStringIncludes(indexSource, "buildCors");
});

Deno.test("enviar-factura-email: exige Authorization Bearer", () => {
  assertStringIncludes(indexSource, "Authorization");
  assertStringIncludes(indexSource, "bearer");
  assertStringIncludes(indexSource, "Missing authorization");
});

Deno.test("enviar-factura-email: valida factura_id y destinatarios", () => {
  assertStringIncludes(indexSource, "factura_id requerido");
  assertStringIncludes(indexSource, "destinatario válido es requerido");
});

Deno.test("enviar-factura-email: service role sin persistir sesión", () => {
  assertStringIncludes(indexSource, "SUPABASE_SERVICE_ROLE_KEY");
  assertStringIncludes(indexSource, "persistSession: false");
});

Deno.test("enviar-factura-email: envuelto con Sentry y captura excepciones", () => {
  assertStringIncludes(indexSource, "wrapEdgeHandler(\"enviar-factura-email\"");
  assertStringIncludes(indexSource, "captureEdgeException");
});

Deno.test("enviar-factura-email: registra envío en factura_envios", () => {
  assertStringIncludes(indexSource, "factura_envios");
});
