/**
 * 13.117.0 — Smoke estructural + invariantes de seguridad de facturapi-emitir.
 *
 * Esta función timbra CFDIs reales contra Facturapi usando SERVICE_ROLE_KEY.
 * Si se quita el check de Authorization, cualquiera puede consumir cuota SAT
 * y dejar facturas en clientes ajenos. La lógica pura está en `helpers_test.ts`.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("facturapi-emitir: rechaza método != POST (405)", () => {
  // GET con body abierto sería un vector de cache poisoning.
  assertStringIncludes(indexSource, '"method_not_allowed"');
  assertStringIncludes(indexSource, '!== "POST"');
});

Deno.test("facturapi-emitir: requiere Authorization header (401 si falta)", () => {
  // Sin esto cualquiera podría timbrar facturas ajenas.
  assertStringIncludes(indexSource, 'req.headers.get("Authorization")');
  assertStringIncludes(indexSource, '"unauthorized"');
});

Deno.test("facturapi-emitir: valida JWT con supabase.auth.getUser (no sólo header presence)", () => {
  // Defensa en profundidad: header puede estar pero ser inválido.
  assertStringIncludes(indexSource, "supabase.auth.getUser()");
});

Deno.test("facturapi-emitir: rechaza factura_id ausente (400)", () => {
  assertStringIncludes(indexSource, '"factura_id_required"');
});

Deno.test("facturapi-emitir: bloquea retimbrado (409 ya_timbrada)", () => {
  // Sin este check, retries duplican CFDIs en Facturapi → dinero perdido en cuota.
  assertStringIncludes(indexSource, '"ya_timbrada"');
  assertStringIncludes(indexSource, "facturapi_id");
});

Deno.test("facturapi-emitir: persistSession=false en el cliente Supabase", () => {
  // Persistir sesión con SERVICE_ROLE sería leak crítico.
  assertStringIncludes(indexSource, "persistSession: false");
});

Deno.test("facturapi-emitir: orden estricto auth → load → llamada externa", () => {
  // Si la llamada a Facturapi ocurre antes del auth check, consumimos cuota
  // pagada por requests no autorizadas.
  const authIdx = indexSource.indexOf("supabase.auth.getUser");
  const loadIdx = indexSource.indexOf('.from("facturas")');
  const fapiIdx = indexSource.indexOf("await fetch(`${FACTURAPI_BASE}/invoices`");
  assertEquals(authIdx > 0 && loadIdx > authIdx && fapiIdx > loadIdx, true,
    `Orden requerido: getUser(${authIdx}) → load facturas(${loadIdx}) → call Facturapi(${fapiIdx})`);
});

Deno.test("facturapi-emitir: wrapped en Sentry", () => {
  assertStringIncludes(indexSource, 'wrapEdgeHandler("facturapi-emitir"');
});

Deno.test("facturapi-emitir: falla limpio si falta FACTURAPI_KEY (no 500 críptico)", () => {
  assertStringIncludes(indexSource, '"missing_facturapi_key"');
});
