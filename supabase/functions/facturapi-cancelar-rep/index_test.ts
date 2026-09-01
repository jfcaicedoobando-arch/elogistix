/**
 * Ola 4 · N5 — Invariantes estructurales de facturapi-cancelar-rep.
 * Sin helpers puros en esta carpeta: se valida por inspección de fuente
 * (mismo patrón que facturapi-cancelar/index_test.ts) para no ejecutar
 * Deno.serve ni requerir red.
 */
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const srcIndex = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
// v13.823.1: la ramificación del resultado vive en `resultadoCancelacion.ts`
// (límite de 200 líneas). Las guardas estructurales miran ambos archivos.
const srcResultado = await Deno.readTextFile(
  new URL("./resultadoCancelacion.ts", import.meta.url),
);
const src = `${srcIndex}\n${srcResultado}`;

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

Deno.test("cancelación repetida pendiente es idempotente y no vuelve a llamar al proveedor", () => {
  const guardIdx = srcIndex.indexOf('["pending", "verifying"].includes');
  const cancelIdx = srcIndex.indexOf('facturapi.invoices.cancel');
  assert(guardIdx >= 0, "debe reconocer solicitudes pendientes o en verificación");
  assert(guardIdx < cancelIdx, "el guard debe ejecutarse antes de solicitar otra cancelación");
  assertStringIncludes(src, "La solicitud de cancelación del REP ya está en verificación ante el SAT.");
});

Deno.test("R4P-01: la rama de sustitución 01 del REP archivado fue retirada", () => {
  const bandera = ["cancelar", "rep", "anterior"].join("_");
  assert(!src.includes(bandera), "no debe quedar el parámetro de la bandera retirada");
  assert(!src.includes("cancelarAnterior"), "no debe quedar la variable cancelarAnterior");
  assert(!src.includes("sin_rep_anterior"), "no debe quedar la rama de REP archivado");
  // El archivo rep_cancelado_* lo mantiene facturapi-emitir-rep (claimRep):
  // aquí ya no se lee ni se limpia.
  assert(!src.includes("rep_cancelado_facturapi_id"), "cancelar-rep ya no toca el archivo rep_cancelado_*");
  // La cancelación normal motivo 01 con UUID sustituto sigue vigente.
  assertStringIncludes(src, "sustituye_uuid_requerido");
  assertStringIncludes(src, "cancelPayload.substitution = sustituyeFacturapiId");
});
