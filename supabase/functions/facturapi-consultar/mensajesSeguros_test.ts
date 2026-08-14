/**
 * Ola 14 · R5EF-03 — el detalle del PAC/SAT ya no sale en el payload al cliente.
 * Run: deno test --no-check supabase/functions/facturapi-consultar/mensajesSeguros_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const srcVerif = await Deno.readTextFile(new URL("./verificacion.ts", import.meta.url));
const srcXml = await Deno.readTextFile(new URL("./xmlSat.ts", import.meta.url));
const srcUuid = await Deno.readTextFile(new URL("../verificar-uuid-sat/index.ts", import.meta.url));

Deno.test("R5EF-03 (verificacion): ningún campo error lleva err.message al cliente", () => {
  const crudos = srcVerif.match(/error: err instanceof Error/g);
  assert(!crudos, `quedan ${crudos?.length} campos error con crudo`);
  assertStringIncludes(srcVerif, "LC_FACTURAPI_DOC_NO_VERIFICABLE:");
  assertStringIncludes(srcVerif, "console.error(");
});

Deno.test("R5EF-03 (xmlSat): raw ya no transporta el mensaje del PAC", () => {
  assert(!srcXml.includes("raw: err instanceof Error"), "raw sigue llevando el crudo");
  assertStringIncludes(srcXml, 'console.error("facturapi-consultar descargarXml:"');
});

Deno.test("R5EF-03 (uuid-sat): el 502 sat_unreachable es genérico y el detalle va al log", () => {
  assert(!srcUuid.includes("detail: (e as Error).message"), "sigue el detail crudo");
  assertStringIncludes(srcUuid, "LC_SAT_NO_DISPONIBLE:");
  assertStringIncludes(srcUuid, 'console.error("verificar-uuid-sat sat_unreachable:"');
  // El 504 sat_timeout (R4EF-04) se conserva intacto:
  assertStringIncludes(srcUuid, "sat_timeout");
  assertStringIncludes(srcUuid, "timeout_ms: SAT_FETCH_TIMEOUT_MS");
});
