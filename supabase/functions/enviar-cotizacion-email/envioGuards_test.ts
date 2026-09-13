// v13.823.355 (YAGNI r2 · P1) — candados de envío: prospecto sin oportunidad y
// estados terminales no vigentes se rechazan aunque se invoque la función
// directo (la UI sólo ocultaba el botón).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validarCotizacionEnviable } from "./envioGuards.ts";

const CORS = { "Access-Control-Allow-Origin": "*" };
// SAFE-CAST: doble de prueba con los campos que leen los candados.
const cot = (extra: Record<string, unknown> = {}) =>
  ({ id: "c1", folio: "COT-1", organization_id: "org1", estado: "Borrador", ...extra }) as unknown as
    Parameters<typeof validarCotizacionEnviable>[0];

Deno.test("prospecto sin oportunidad ⇒ LC_COT_SIN_OPORTUNIDAD", async () => {
  const res = validarCotizacionEnviable(cot({ es_prospecto: true, oportunidad_id: null }), CORS)!;
  assertEquals(res.status, 400);
  assertEquals((await res.json()).code, "LC_COT_SIN_OPORTUNIDAD");
});

Deno.test("estados terminales ⇒ LC_COT_ESTADO_NO_ENVIABLE", async () => {
  for (const estado of ["Rechazada", "Vencida", "Archivada"]) {
    const res = validarCotizacionEnviable(cot({ estado }), CORS)!;
    assertEquals(res.status, 400);
    assertEquals((await res.json()).code, "LC_COT_ESTADO_NO_ENVIABLE");
  }
});

Deno.test("Enviada/Aceptada y prospecto ligado sí pasan", () => {
  assertEquals(validarCotizacionEnviable(cot({ estado: "Enviada" }), CORS), null);
  assertEquals(validarCotizacionEnviable(cot({ estado: "Aceptada" }), CORS), null);
  assertEquals(
    validarCotizacionEnviable(cot({ es_prospecto: true, oportunidad_id: "op1" }), CORS),
    null,
  );
});
