/**
 * P1-IVA — El REP no puede declarar dos tratamientos en un solo grupo.
 *
 * Antes `resolverTrasladoDr` devolvía el grupo de tasa positiva e ignoraba los
 * renglones exentos o a tasa 0: el complemento de pago trataba TODO el importe
 * como gravado. Ahora cualquier mezcla de tratamientos se bloquea (null) y el
 * llamador responde 422 antes del claim.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MSG_IVA_MULTITASA, resolverTrasladoDr } from "./trasladoDr.ts";

Deno.test("16% + exento se bloquea (antes declaraba todo al 16%)", () => {
  assertEquals(
    resolverTrasladoDr([
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 },
      { tipo_iva: "exento", tasa_iva_aplicada: null },
    ]),
    null,
  );
});

Deno.test("16% + tasa 0% se bloquea", () => {
  assertEquals(
    resolverTrasladoDr([
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 },
      { tipo_iva: "tasa_0", tasa_iva_aplicada: 0 },
    ]),
    null,
  );
});

Deno.test("exento + tasa 0% se bloquea (antes terminaba como Tasa 0)", () => {
  assertEquals(
    resolverTrasladoDr([
      { tipo_iva: "exento", tasa_iva_aplicada: null },
      { tipo_iva: "tasa_0", tasa_iva_aplicada: 0 },
    ]),
    null,
  );
});

Deno.test("8% + exento se bloquea", () => {
  assertEquals(
    resolverTrasladoDr([
      { tipo_iva: "gravado_8", tasa_iva_aplicada: 0.08 },
      { tipo_iva: "exento", tasa_iva_aplicada: null },
    ]),
    null,
  );
});

Deno.test("los casos homogéneos siguen pasando", () => {
  assertEquals(
    resolverTrasladoDr([
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 },
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 },
    ]),
    { tasa: 0.16, factor: "Tasa" },
  );
  assertEquals(
    resolverTrasladoDr([{ tipo_iva: "gravado_8", tasa_iva_aplicada: 0.08 }]),
    { tasa: 0.08, factor: "Tasa" },
  );
  assertEquals(
    resolverTrasladoDr([{ tipo_iva: "exento" }, { tipo_iva: "exento" }]),
    { tasa: 0, factor: "Exento" },
  );
  assertEquals(
    resolverTrasladoDr([{ tipo_iva: "tasa_0", tasa_iva_aplicada: 0 }]),
    { tasa: 0, factor: "Tasa" },
  );
  assertEquals(resolverTrasladoDr([]), "sin_conceptos");
});

Deno.test("el mensaje explica la mezcla y no sugiere declarar una sola tasa", () => {
  assertEquals(MSG_IVA_MULTITASA.startsWith("LC_REP_IVA_MULTITASA:"), true);
  assertEquals(MSG_IVA_MULTITASA.includes("exento"), true);
  assertEquals(MSG_IVA_MULTITASA.includes("tasa 0%"), true);
  assertEquals(MSG_IVA_MULTITASA.includes("homogéneo"), true);
});
