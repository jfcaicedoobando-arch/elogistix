/**
 * P0 · REP con conceptos "No objeto de impuesto" (SAT ObjetoImp 01) por la vía
 * ESTRUCTURADA del SDK 5.1.0 (`related_documents[].taxability`).
 *
 * Conducta correcta (sin XML manual, sin `type: "custom"`, sin traducir "no
 * objeto" a Exento ni a tasa 0%):
 *  - documento 100% no objeto ⇒ taxability "01" y `taxes: []`;
 *  - factura mixta 16% + no objeto ⇒ taxability "02" con un solo traslado de
 *    IVA 16% sobre la base gravada prorrateada;
 *  - gravada / exenta / tasa 0 ⇒ taxability "02" sin regresión.
 * `calculoLocalRep` (cotejo con `paymentSummary`) usa la MISMA regla.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildRepPayload, type PagoContext } from "./helpers.ts";
import { buildTaxesDr } from "./taxesDr.ts";
import { calculoLocalRep } from "./resumenProveedor.ts";

type Dr = PagoContext["documento_relacionado"];

function ctxCon(dr: Partial<Dr>): PagoContext {
  return {
    factura_id: "f1",
    receptor: {
      legal_name: "CLIENTE SA",
      tax_id: "AAA010101AAA",
      tax_system: "601",
      address: { zip: "44100" },
    },
    forma_pago: "03",
    fecha_pago: "2026-09-20T12:00:00",
    monto: 1160,
    moneda: "MXN",
    tipo_cambio: 1,
    documento_relacionado: {
      uuid: "11111111-1111-1111-1111-111111111111",
      moneda_dr: "MXN",
      tipo_cambio_dr: 1,
      num_parcialidad: 1,
      imp_saldo_ant: 1160,
      imp_pagado: 1160,
      imp_saldo_insoluto: 0,
      metodo_pago: "PPD",
      tasa_iva: 0.16,
      factor_iva: "Tasa",
      ...dr,
    },
  } as unknown as PagoContext;
}

function docRel(ctx: PagoContext) {
  return buildRepPayload(ctx).complements[0].data[0].related_documents[0];
}

Deno.test("documento 100% no objeto: taxability 01 y taxes vacío", () => {
  const ctx = ctxCon({
    tasa_iva: 0,
    imp_pagado: 1000,
    imp_saldo_ant: 1000,
    grupos_iva: [],
    hay_no_objeto: true,
    objeto_imp_dr: "01",
    importe_no_objeto: 1000,
    subtotal_factura: 1000,
    total_factura: 1000,
  });
  const rdoc = docRel(ctx);
  assertEquals(rdoc.taxability, "01");
  assertEquals(rdoc.taxes, []);
  // Paridad: el cotejo con paymentSummary usa la misma regla, sin IVA tasa 0.
  assertEquals(calculoLocalRep(ctx).taxes, []);
});

Deno.test("factura mixta 16% + no objeto: taxability 02 y sólo el IVA gravado", () => {
  const ctx = ctxCon({
    tasa_iva: 0.16,
    imp_pagado: 15600,
    imp_saldo_ant: 15600,
    grupos_iva: [{ tasa: 0.16, factor: "Tasa", importe: 10000 }],
    hay_no_objeto: true,
    objeto_imp_dr: "02",
    importe_no_objeto: 4000,
    subtotal_factura: 14000,
    total_factura: 15600,
  });
  const rdoc = docRel(ctx);
  assertEquals(rdoc.taxability, "02");
  assertEquals(rdoc.taxes.length, 1);
  assertEquals(rdoc.taxes[0].type, "IVA");
  assertEquals(rdoc.taxes[0].rate, 0.16);
  assertEquals(rdoc.taxes[0].withholding, false);
  // BaseDR = imp_pagado × importe_gravado / total (el no objeto sólo entra al
  // denominador): 15600 × 10000 / 15600 = 10000.
  assertEquals(rdoc.taxes[0].base, 10000);
  assertEquals(calculoLocalRep(ctx).taxes[0].base, 10000);
});

Deno.test("gravada, exenta y tasa 0 siguen con taxability 02 y su traslado", () => {
  const gravada = docRel(ctxCon({}));
  assertEquals(gravada.taxability, "02");
  assertEquals(gravada.taxes.length, 1);
  assertEquals(gravada.taxes[0].factor, "Tasa");

  const exenta = docRel(ctxCon({ tasa_iva: 0, factor_iva: "Exento", imp_pagado: 1000, imp_saldo_ant: 1000 }));
  assertEquals(exenta.taxability, "02");
  assertEquals(exenta.taxes[0].factor, "Exento");

  const tasa0 = docRel(ctxCon({
    tasa_iva: 0,
    imp_pagado: 1000,
    imp_saldo_ant: 1000,
    grupos_iva: [{ tasa: 0, factor: "Tasa", importe: 1000 }],
    subtotal_factura: 1000,
    total_factura: 1000,
  }));
  assertEquals(tasa0.taxability, "02");
  assertEquals(tasa0.taxes[0].rate, 0);
});

Deno.test("sin objeto_imp_dr el fallback seguro es 02 (declara impuestos)", () => {
  const rdoc = docRel(ctxCon({ objeto_imp_dr: undefined }));
  assertEquals(rdoc.taxability, "02");
  assertEquals(rdoc.taxes.length, 1);
});

Deno.test("el complemento del REP es SIEMPRE type pago (jamás custom)", () => {
  for (const objeto of ["01", "02"] as const) {
    const payload = buildRepPayload(ctxCon({
      objeto_imp_dr: objeto,
      hay_no_objeto: objeto === "01",
      grupos_iva: objeto === "01" ? [] : undefined,
    }));
    assertEquals(payload.type, "P");
    assertEquals(payload.complements.length, 1);
    assertEquals(payload.complements[0].type, "pago");
    assertEquals(JSON.stringify(payload).includes('"custom"'), false);
  }
});

Deno.test("taxability 01 tampoco declara retenciones (no hay renglón con objeto)", () => {
  assertEquals(
    buildTaxesDr({
      tasa_iva: 0,
      imp_pagado: 1000,
      factor_iva: "Tasa",
      objeto_imp_dr: "01",
      grupos_iva: [],
      importe_no_objeto: 1000,
      subtotal_factura: 1000,
      total_factura: 1000,
      retenciones: [{ tipo: "IVA", tasa: 0.04, importe: 1000 }],
    }),
    [],
  );
});
