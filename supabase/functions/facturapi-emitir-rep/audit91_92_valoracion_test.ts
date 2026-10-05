import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildRepPayload, equivalenciaDelCobro, validateRepContext, type PagoContext } from "./helpers.ts";
import { construirPagoContext } from "./etapaContexto.ts";
import { resolverFiscalDr } from "./etapaFiscal.ts";
import { tomarClaimRep } from "./claimRep.ts";

function contexto(moneda = "MXN", monto = 20, tipoCambio = 20): PagoContext {
  const fiscal = resolverFiscalDr([{ tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 100 }], { subtotal: 100, iva: 16 });
  assert(fiscal.ok);
  return construirPagoContext({
    factura: { id: "f", cliente_id: "c", uuid_fiscal: "11111111-2222-4333-8444-555555555555",
      moneda: "USD", tipo_cambio: 18.1903, total: 116, subtotal: 100, iva: 16 },
    pago: { id: "p", factura_id: "f", organization_id: "o", moneda, monto, tipo_cambio: tipoCambio,
      monto_aplicado_factura: 1, fecha_pago: "2026-10-04", forma_pago: "03" },
    datos: { cliente: { id: "c", nombre: "Cliente", rfc: "XAXX010101000", codigo_postal: "64000", regimen_fiscal: "601" },
      emailContacto: null, parcialidad: { numParcialidad: 2, saldoAnt: 115, impPagado: 1, saldoInsoluto: 114 }, refs: { expediente: null, bl_master: null, bl_house: null } },
    fiscal: fiscal.fiscal,
  });
}

Deno.test("AUD91: USD1 aplicaUSD1 y TipoCambioP18.1903 independiente de equivalencia neutral", () => {
  const ctx = contexto("USD", 1, 18.1903);
  assertEquals(validateRepContext(ctx), []);
  const pago = buildRepPayload(ctx).complements[0].data[0];
  assertEquals(pago.exchange, 18.1903);
  assertEquals(pago.related_documents[0].amount, 1);
  assertEquals(pago.related_documents[0].exchange, undefined);
  assertEquals(equivalenciaDelCobro(ctx), 1);
});

Deno.test("AUD91: no volver a timbrar una valuación neutral USD1 del histórico P4", () => {
  assert(validateRepContext(contexto("USD", 1, 1)).some((e) => e.field === "tipo_cambio"));
  assertThrows(() => buildRepPayload(contexto("USD", 1, 1)));
});

Deno.test("AUD92: MXN20 recibido no se reconstruye con TC18.1903 de emisión", () => {
  const ctx = contexto();
  assertEquals(validateRepContext(ctx), []);
  const pago = buildRepPayload(ctx).complements[0].data[0];
  const dr = pago.related_documents[0];
  assertEquals(pago.currency, "MXN");
  assertEquals(pago.exchange, undefined); // SDK/SAT default TipoCambioP = 1.
  assertEquals(dr.amount, 1);
  assertEquals(dr.exchange, 0.05);
  assertEquals(dr.amount / dr.exchange!, 20);
  assertEquals(dr.last_balance, 115);
  assertEquals(dr.installment, 2);
});

Deno.test("AUD92: tasa igual a emisión, negativa/positiva y redondeo preservan importe recibido", () => {
  for (const monto of [18.19, 17, 20, 23.01, 1000.03]) {
    const ctx = contexto("MXN", monto, 20);
    ctx.documento_relacionado.imp_pagado = Math.round(monto / 20 * 1e4) / 1e4;
    const pago = buildRepPayload(ctx).complements[0].data[0];
    const dr = pago.related_documents[0];
    assertEquals(Math.round(dr.amount / dr.exchange! * 100) / 100, monto);
    assertEquals(Number(dr.exchange!.toFixed(10)), dr.exchange);
  }
});

Deno.test("AUD92: USD sobreMXN y EURsobreUSD usan equivalencia efectivamente aplicada", () => {
  for (const [mp, mf, monto, aplicado, tc] of [["USD","MXN",1,20,20],["EUR","USD",20,22,21]] as const) {
    const ctx = contexto(mp,monto,tc);
    Object.assign(ctx.documento_relacionado, { moneda_dr: mf, imp_pagado: aplicado });
    const pago = buildRepPayload(ctx).complements[0].data[0];
    assertEquals(pago.exchange, tc);
    assertEquals(pago.related_documents[0].exchange, aplicado / monto);
  }
});

Deno.test("AUD92: datos no representables bloquean payload en lugar de alterar Monto", () => {
  for (const monto of [0, -1, NaN, Infinity]) {
    const ctx = contexto("MXN", monto, 20);
    assert(validateRepContext(ctx).length > 0);
    assertThrows(() => buildRepPayload(ctx));
  }
  const ctx = contexto("USD", 1, 20);
  ctx.documento_relacionado.imp_pagado = 2;
  assertThrows(() => buildRepPayload(ctx));
});

Deno.test("AUD92: claim CAS detecta cambio tras preflight y no reserva instantánea vieja", async () => {
  const filtros: Array<[string, unknown]> = [];
  const q = {
    eq: (k: string, v: string) => { filtros.push([k,v]); return q; },
    is: (k: string, v: null) => { filtros.push([k,v]); return q; },
    select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
  };
  const db = { from: () => ({ update: () => q }) };
  const res = await tomarClaimRep(db, { id:"p", updated_at:"2026-10-04T01:00:00Z" }, "PENDING:new", "2026-10-04T02:00:00Z");
  assertEquals(res.ok, false);
  assert(filtros.some(([k,v]) => k === "updated_at" && v === "2026-10-04T01:00:00Z"));
  assert(filtros.some(([k,v]) => k === "deleted_at" && v === null));
});
