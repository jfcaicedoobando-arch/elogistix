/**
 * P1 · Auditoría IVA — Igual que la factura de ingreso: una NC con ObjetoImp 01
 * no puede declarar impuestos (ni traslado ni retenciones). Se bloquea en la
 * validación del contexto y el builder nunca los agrega.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildTaxesNc, validateNcContext, type NotaCreditoContext } from "./helpers.ts";
import { MSG_NO_OBJETO_RETENCIONES } from "../_shared/noObjetoFiscal.ts";

const baseCtx: NotaCreditoContext = {
  serie: "NC",
  uso_cfdi: "G02",
  forma_pago: "03",
  moneda: "MXN",
  tipo_cambio: 1,
  uuid_factura_relacionada: "11111111-1111-1111-1111-111111111111",
  receptor: {
    legal_name: "ACME SA",
    tax_id: "AAA010101AAA",
    tax_system: "601",
    address: { zip: "06600" },
  },
  conceptos: [{
    descripcion: "Servicio no objeto",
    cantidad: 1,
    precio_unitario: 1000,
    clave_sat: "78101800",
    clave_unidad: "E48",
    unidad: "Servicio",
    tipo_iva: "no_objeto",
    tasa_iva: null,
  }],
};

const conRetencion = (campo: "tasa_ret_isr" | "tasa_ret_iva", tasa: number): NotaCreditoContext => ({
  ...baseCtx,
  conceptos: [{ ...baseCtx.conceptos[0], [campo]: tasa }],
});

Deno.test("NC no objeto sin retenciones: contexto válido y taxes vacío", () => {
  assertEquals(validateNcContext(baseCtx).length, 0);
  assertEquals(buildTaxesNc(baseCtx.conceptos[0]), []);
});

Deno.test("NC no objeto + ISR retenido se bloquea antes del claim", () => {
  const issues = validateNcContext(conRetencion("tasa_ret_isr", 0.1));
  assert(issues.some((i) => i.message.includes(MSG_NO_OBJETO_RETENCIONES)));
});

Deno.test("NC no objeto + IVA retenido se bloquea antes del claim", () => {
  const issues = validateNcContext(conRetencion("tasa_ret_iva", 0.04));
  assert(issues.some((i) => i.message.includes(MSG_NO_OBJETO_RETENCIONES)));
});

Deno.test("buildTaxesNc jamás agrega retenciones a un renglón no objeto", () => {
  for (const campo of ["tasa_ret_isr", "tasa_ret_iva"] as const) {
    assertEquals(buildTaxesNc(conRetencion(campo, 0.1).conceptos[0]), []);
  }
});

Deno.test("un renglón gravado de la NC sí reversa sus retenciones", () => {
  const taxes = buildTaxesNc({
    ...baseCtx.conceptos[0],
    tipo_iva: "gravado_16",
    tasa_iva: 0.16,
    tasa_ret_isr: 0.1,
    tasa_ret_iva: 0.04,
  });
  assertEquals(taxes.filter((t) => t.withholding).length, 2);
  assert(taxes.some((t) => !t.withholding && t.rate === 0.16));
});
