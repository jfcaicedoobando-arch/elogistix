/**
 * P1-IVA (servidor) — el timbrado no adivina el tratamiento fiscal.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { clasificarCoherenciaIva } from "./coherenciaIva.ts";

const contextoSource = await Deno.readTextFile(new URL("../facturapi-emitir/contexto.ts", import.meta.url));

Deno.test("gravado 16% con tasa 0.16 es coherente", () => {
  assertEquals(clasificarCoherenciaIva({ tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 }).estado, "ok");
});

Deno.test("gravado sin tasa NO se rellena con 16%: bloquea", () => {
  const r = clasificarCoherenciaIva({ tipo_iva: "gravado_16", tasa_iva_aplicada: null });
  assertEquals(r.estado, "incoherente");
});

Deno.test("no objeto y exento conservan su tratamiento y no causan IVA", () => {
  assertEquals(clasificarCoherenciaIva({ tipo_iva: "no_objeto" }).estado, "ok");
  assertEquals(clasificarCoherenciaIva({ tipo_iva: "no_objeto" }).tasa, 0);
  assertEquals(clasificarCoherenciaIva({ tipo_iva: "exento" }).tipo, "exento");
  assertEquals(clasificarCoherenciaIva({ tipo_iva: "exento", tasa_iva_aplicada: 0.16 }).estado, "incoherente");
});

Deno.test("tasa 0% con 16% capturado bloquea", () => {
  assertEquals(clasificarCoherenciaIva({ tipo_iva: "tasa_0", tasa_iva_aplicada: 0.16 }).estado, "incoherente");
});

Deno.test("legado sin tipo con IVA apagado y tasa heredada queda ambiguo", () => {
  assertEquals(clasificarCoherenciaIva({ aplica_iva: false, tasa_iva_aplicada: 0.16 }).estado, "ambiguo");
});

Deno.test("contexto: bloquea con 422 antes de armar el payload y sin fallback 16%", () => {
  assertStringIncludes(contextoSource, '"tipo_iva_indeterminado"');
  assertStringIncludes(contextoSource, "clasificarCoherenciaIva");
  if (contextoSource.includes('?? "gravado_16"') || contextoSource.includes(": 0.16")) {
    throw new Error("Regresó el fallback silencioso de tratamiento/tasa en el contexto de emisión");
  }
});
