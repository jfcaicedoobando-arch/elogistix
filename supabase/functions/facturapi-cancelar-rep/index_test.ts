/**
 * Ola 4 · N5 — Invariantes estructurales de facturapi-cancelar-rep.
 * Sin helpers puros en esta carpeta: se valida por inspección de fuente
 * (mismo patrón que facturapi-cancelar/index_test.ts) para no ejecutar
 * Deno.serve ni requerir red.
 */
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("N5: substitution usa el facturapi_rep_id (ObjectId) del REP sustituto, no el UUID SAT", () => {
  assertStringIncludes(src, "sustituyeFacturapiId");
  assertStringIncludes(src, "cancelPayload.substitution = sustituyeFacturapiId");
  // La resolución busca por uuid_rep y toma facturapi_rep_id, nunca al revés.
  assertStringIncludes(src, '.eq("uuid_rep", body.sustituye_uuid!)');
  assertStringIncludes(src, "sustituyeFacturapiId = sustituto.facturapi_rep_id");
});

Deno.test("N5: se persiste rep_cancellation_status en todas las ramas (rechazada/pendiente/aceptada)", () => {
  const ocurrencias = src.split("rep_cancellation_status:").length - 1;
  assert(ocurrencias >= 3, "debe fijar rep_cancellation_status en cada rama de resultado");
});

Deno.test("N5: sólo marca estado_rep=Cancelado cuando rep_cancellation_status=accepted", () => {
  const idx = src.indexOf('estado_rep: "Cancelado"');
  assert(idx >= 0);
  const bloque = src.slice(Math.max(0, idx - 400), idx + 200);
  assertStringIncludes(bloque, '"accepted"');
});
