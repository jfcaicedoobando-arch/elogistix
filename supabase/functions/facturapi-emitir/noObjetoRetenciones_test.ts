/**
 * P1 · Auditoría IVA — Con ObjetoImp = 01 ("No objeto de impuesto") la guía de
 * llenado del SAT prohíbe el nodo de impuestos. Antes el payload salía con
 * `taxability:"01"` y las retenciones de ISR/IVA dentro, y sólo lo rechazaba el
 * PAC. Ahora se bloquea aquí, ANTES del claim, y el builder nunca agrega
 * impuestos a un renglón no objeto.
 *
 * El método PPD NO se bloquea: Facturapi confirmó que `payment_method` es del
 * CFDI completo y `taxability` es por concepto, así que la factura mixta
 * (no objeto + gravado 16%) se emite normalmente.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildFacturapiPayload, validateContext, type FacturaContext } from "./helpers.ts";
import { MSG_NO_OBJETO_RETENCIONES } from "../_shared/noObjetoFiscal.ts";

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

Deno.test("factura mixta PPD (no objeto + gravado 16%) pasa validación y serializa cada línea", () => {
  const ctx: FacturaContext = {
    ...baseCtx,
    metodo_pago: "PPD",
    // PPD sin pago recibido ⇒ FormaPago 99 (Por definir), regla del Anexo 20.
    forma_pago: "99",
    conceptos: [
      baseCtx.conceptos[0],
      {
        ...baseCtx.conceptos[0],
        descripcion: "Servicio gravado",
        tipo_iva: "gravado_16",
        tasa_iva: 0.16,
      },
    ],
  };
  assertEquals(validateContext(ctx).length, 0);
  const payload = buildFacturapiPayload(ctx);
  assertEquals(payload.payment_method, "PPD");
  // Renglón no objeto: ObjetoImp 01 y SIN nodo de impuestos.
  assertEquals(payload.items[0].product.taxability, "01");
  assertEquals(payload.items[0].product.taxes, []);
  // Renglón gravado: ObjetoImp 02 (default de Facturapi) con su IVA al 16%.
  assertEquals(payload.items[1].product.taxability, undefined);
  assertEquals(payload.items[1].product.taxes, [{ type: "IVA", rate: 0.16, factor: "Tasa" }]);
});

Deno.test("PUE con no objeto sigue igual (sin advertencias ni cambios de payload)", () => {
  assertEquals(validateContext(baseCtx).length, 0);
  assertEquals(buildFacturapiPayload(baseCtx).payment_method, "PUE");
});


Deno.test("un renglón gravado sí conserva sus retenciones (sin regresión)", () => {
  const ctx: FacturaContext = {
    ...baseCtx,
    metodo_pago: "PPD",
    // PPD sin pago recibido ⇒ FormaPago 99 (Por definir), regla del Anexo 20.
    forma_pago: "99",
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
