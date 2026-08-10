/**
 * Ola 4 · N4 — Invariantes estructurales de facturapi-cancelar-nota-credito.
 * Sin helpers puros en esta carpeta: se valida por inspección de fuente
 * (mismo patrón que facturapi-cancelar/index_test.ts) para no ejecutar
 * Deno.serve ni requerir red.
 */
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("N4: substitution usa el facturapi_id (ObjectId) de la NC sustituta, no el UUID SAT", () => {
  assertStringIncludes(src, "sustituyeFacturapiId");
  assertStringIncludes(src, "cancelPayload.substitution = sustituyeFacturapiId");
  // La resolución busca por uuid_fiscal y toma facturapi_id, nunca al revés.
  assertStringIncludes(src, '.eq("uuid_fiscal", body.sustituye_uuid!)');
  assertStringIncludes(src, "sustituyeFacturapiId = sustituta.facturapi_id");
});

Deno.test("N4: se persiste cancellation_status en todas las ramas (rechazada/pendiente/aceptada)", () => {
  const ocurrencias = src.split("cancellation_status:").length - 1;
  assert(ocurrencias >= 3, "debe fijar cancellation_status en cada rama de resultado");
});

Deno.test("N4: sólo marca estado=Cancelada cuando cancellation_status=accepted", () => {
  const idx = src.indexOf('estado: "Cancelada"');
  assert(idx >= 0);
  const bloque = src.slice(Math.max(0, idx - 400), idx + 200);
  assertStringIncludes(bloque, '"accepted"');
});
