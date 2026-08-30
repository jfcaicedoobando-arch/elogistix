import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildNcPayload, validateNcContext, type NotaCreditoContext } from "./helpers.ts";

const baseCtx = (): NotaCreditoContext => ({
  serie: "NC",
  uso_cfdi: "G02",
  forma_pago: "01",
  moneda: "MXN",
  tipo_cambio: 1,
  uuid_factura_relacionada: "00000000-0000-0000-0000-000000000001",
  receptor: {
    legal_name: "ACME SA DE CV",
    tax_id: "AAA010101AAA",
    tax_system: "601",
    address: { zip: "44100" },
    email: null,
  },
  conceptos: [{
    descripcion: "Descuento parcial",
    cantidad: 1,
    precio_unitario: 500,
    clave_sat: "78101800",
    clave_unidad: "E48",
    unidad: "Servicio",
    tasa_iva: 0.16,
  }],
});

Deno.test("validateNcContext ok con datos completos", () => {
  assertEquals(validateNcContext(baseCtx()).length, 0);
});

Deno.test("validateNcContext detecta falta de UUID relacionado", () => {
  const ctx = baseCtx();
  ctx.uuid_factura_relacionada = "";
  const issues = validateNcContext(ctx);
  assertEquals(issues.some((i) => i.field === "factura"), true);
});

Deno.test("validateNcContext detecta RFC inválido", () => {
  const ctx = baseCtx();
  ctx.receptor.tax_id = "XXX";
  const issues = validateNcContext(ctx);
  assertEquals(issues.some((i) => i.field === "rfc"), true);
});

Deno.test("validateNcContext detecta sin conceptos", () => {
  const ctx = baseCtx();
  ctx.conceptos = [];
  const issues = validateNcContext(ctx);
  assertEquals(issues.some((i) => i.field === "conceptos"), true);
});

Deno.test("buildNcPayload arma type E, related y relationship 01", () => {
  const p = buildNcPayload(baseCtx());
  assertEquals(p.type, "E");
  assertEquals(p.relationship, "01");
  assertEquals(p.related, ["00000000-0000-0000-0000-000000000001"]);
  assertEquals(p.serie, "NC");
  assertEquals(p.items.length, 1);
  assertEquals(p.items[0].product.taxes[0].rate, 0.16);
});

Deno.test("validateNcContext aplica la banda fiscal 5..40 en moneda extranjera", () => {
  for (const tc of [1, 4.99, 40.01, NaN]) {
    const ctx = baseCtx();
    ctx.moneda = "USD";
    ctx.tipo_cambio = tc;
    assertEquals(
      validateNcContext(ctx).some((i) => i.field === "tipo_cambio"),
      true,
      `TC ${String(tc)} debía bloquear`,
    );
  }
  for (const tc of [5, 17.5, 40]) {
    const ctx = baseCtx();
    ctx.moneda = "USD";
    ctx.tipo_cambio = tc;
    assertEquals(validateNcContext(ctx).some((i) => i.field === "tipo_cambio"), false);
  }
});

Deno.test("buildNcPayload incluye exchange sólo para moneda no MXN", () => {
  const ctx = baseCtx();
  ctx.moneda = "USD";
  ctx.tipo_cambio = 17.5;
  const p = buildNcPayload(ctx);
  assertEquals(p.exchange, 17.5);
  const p2 = buildNcPayload(baseCtx());
  assertEquals(p2.exchange, undefined);
});
