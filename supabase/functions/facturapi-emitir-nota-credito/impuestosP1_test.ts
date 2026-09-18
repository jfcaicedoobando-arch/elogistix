/**
 * P1-IVA — Impuestos del CFDI de egreso: tratamiento fiel por renglón y
 * reverso de retenciones ISR/IVA.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildTaxesNc,
  tratamientoNcIndeterminado,
  validateNcContext,
  type ConceptoNC,
  type NotaCreditoContext,
} from "./helpers.ts";

const concepto = (extra: Partial<ConceptoNC> = {}): ConceptoNC => ({
  descripcion: "Servicio",
  cantidad: 1,
  precio_unitario: 1000,
  clave_sat: "84111506",
  clave_unidad: "E48",
  ...extra,
});

Deno.test("gravado 16% y 8% conservan su tasa", () => {
  assertEquals(buildTaxesNc(concepto({ tipo_iva: "gravado_16", tasa_iva: 0.16 })), [
    { type: "IVA", rate: 0.16, factor: "Tasa" },
  ]);
  assertEquals(buildTaxesNc(concepto({ tipo_iva: "gravado_8", tasa_iva: 0.08 })), [
    { type: "IVA", rate: 0.08, factor: "Tasa" },
  ]);
  // Sin tasa guardada, el 8% no se vuelve 16%.
  assertEquals(buildTaxesNc(concepto({ tipo_iva: "gravado_8" })), [
    { type: "IVA", rate: 0.08, factor: "Tasa" },
  ]);
});

Deno.test("tasa 0, exento y no objeto se declaran distinto entre sí", () => {
  assertEquals(buildTaxesNc(concepto({ tipo_iva: "tasa_0", tasa_iva: 0 })), [
    { type: "IVA", rate: 0, factor: "Tasa" },
  ]);
  assertEquals(buildTaxesNc(concepto({ tipo_iva: "exento", tasa_iva: 0.16 })), [
    { type: "IVA", rate: 0, factor: "Exento" },
  ]);
  assertEquals(buildTaxesNc(concepto({ tipo_iva: "no_objeto" })), []);
});

Deno.test("la NC reversa las retenciones ISR e IVA", () => {
  assertEquals(
    buildTaxesNc(concepto({ tipo_iva: "gravado_16", tasa_iva: 0.16, tasa_ret_isr: 0.1, tasa_ret_iva: 0.04 })),
    [
      { type: "IVA", rate: 0.16, factor: "Tasa" },
      { type: "ISR", rate: 0.1, factor: "Tasa", withholding: true },
      { type: "IVA", rate: 0.04, factor: "Tasa", withholding: true },
    ],
  );
});

Deno.test("un renglón exento con retención sólo lleva Exento + retención", () => {
  assertEquals(
    buildTaxesNc(concepto({ tipo_iva: "exento", tasa_ret_isr: 0.1 })),
    [
      { type: "IVA", rate: 0, factor: "Exento" },
      { type: "ISR", rate: 0.1, factor: "Tasa", withholding: true },
    ],
  );
});

Deno.test("tratamiento indeterminado bloquea la emisión con mensaje claro", () => {
  assertEquals(tratamientoNcIndeterminado(concepto()), true);
  // P1-IVA: una tasa suelta ya NO basta; sin tipo el renglón es indeterminado.
  assertEquals(tratamientoNcIndeterminado(concepto({ tasa_iva: 0.16 })), true);
  assertEquals(tratamientoNcIndeterminado(concepto({ tipo_iva: "exento" })), false);
  // SAFE-CAST: valor inválido a propósito para probar el fail-closed.
  assertEquals(tratamientoNcIndeterminado(concepto({ tipo_iva: "gravado_11" as never })), true);

  const ctx: NotaCreditoContext = {
    uso_cfdi: "G02",
    forma_pago: "15",
    moneda: "MXN",
    tipo_cambio: 1,
    uuid_factura_relacionada: "11111111-1111-1111-1111-111111111111",
    receptor: {
      legal_name: "Cliente SA",
      tax_id: "AAA010101AAA",
      tax_system: "601",
      address: { zip: "44100" },
    },
    conceptos: [concepto()],
  };
  const issues = validateNcContext(ctx);
  const problema = issues.find((i) => i.field === "conceptos[0].tipo_iva");
  assertEquals(problema !== undefined, true);
  assertEquals(problema!.message.includes("no objeto"), true);
  assertEquals(problema!.message.includes("no se supone una tasa"), true);
});
