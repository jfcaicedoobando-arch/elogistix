/**
 * P1 · Auditoría IVA — Con ObjetoImp = 01 ("No objeto de impuesto") la guía de
 * llenado del SAT prohíbe el nodo de impuestos. Antes el payload salía con
 * `taxability:"01"` y las retenciones de ISR/IVA dentro, y sólo lo rechazaba el
 * PAC. Ahora se bloquea aquí, ANTES del claim, y el builder nunca agrega
 * impuestos a un renglón no objeto.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildFacturapiPayload, validateContext, type FacturaContext } from "./helpers.ts";
import { MSG_NO_OBJETO_PPD, MSG_NO_OBJETO_RETENCIONES } from "../_shared/noObjetoFiscal.ts";

const baseCtx: FacturaContext = {
  serie: "A",
  forma_pago: "03",
  metodo_pago: "PUE",
  uso_cfdi: "G03",
  moneda: "MXN",
  tipo_cambio: 1,
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

function conRetencion(campo: "tasa_ret_isr" | "tasa_ret_iva", tasa: number): FacturaContext {
  return { ...baseCtx, conceptos: [{ ...baseCtx.conceptos[0], [campo]: tasa }] };
}

Deno.test("no objeto sin impuestos: payload con taxability 01 y taxes vacío", () => {
  const p = buildFacturapiPayload(baseCtx);
  assertEquals(p.items[0].product.taxability, "01");
  assertEquals(p.items[0].product.taxes, []);
  assertEquals(validateContext(baseCtx).length, 0);
});

Deno.test("no objeto + ISR retenido se bloquea antes del claim", () => {
  const issues = validateContext(conRetencion("tasa_ret_isr", 0.1));
  assert(issues.some((i) => i.message.includes(MSG_NO_OBJETO_RETENCIONES)));
});

Deno.test("no objeto + IVA retenido se bloquea antes del claim", () => {
  const issues = validateContext(conRetencion("tasa_ret_iva", 0.04));
  assert(issues.some((i) => i.message.includes(MSG_NO_OBJETO_RETENCIONES)));
});

Deno.test("el builder tampoco cuela la retención si llegara a pasar", () => {
  for (const campo of ["tasa_ret_isr", "tasa_ret_iva"] as const) {
    const p = buildFacturapiPayload(conRetencion(campo, 0.1));
    assertEquals(p.items[0].product.taxes, []);
  }
});

Deno.test("no objeto + PPD se bloquea: el cobro se quedaría sin REP", () => {
  const issues = validateContext({ ...baseCtx, metodo_pago: "PPD" });
  assert(issues.some((i) => i.message === MSG_NO_OBJETO_PPD));
});

Deno.test("un renglón gravado sí conserva sus retenciones (sin regresión)", () => {
  const ctx: FacturaContext = {
    ...baseCtx,
    metodo_pago: "PPD",
    conceptos: [{
      ...baseCtx.conceptos[0],
      tipo_iva: "gravado_16",
      tasa_iva: 0.16,
      tasa_ret_isr: 0.1,
      tasa_ret_iva: 0.04,
    }],
  };
  assertEquals(validateContext(ctx).length, 0);
  const taxes = buildFacturapiPayload(ctx).items[0].product.taxes;
  assertEquals(taxes.filter((t) => t.withholding).length, 2);
  assert(taxes.some((t) => !t.withholding && t.rate === 0.16));
});
