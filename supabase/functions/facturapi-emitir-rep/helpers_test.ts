import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildRepPayload, validateRepContext, normalizarFormaPago, type PagoContext } from "./helpers.ts";
import { calcularRetencionesDr } from "./retencionesDr.ts";
import { factorIvaFacturaOriginal, tasaIvaFacturaOriginal } from "./context.ts";

const validCtx: PagoContext = {
  receptor: {
    legal_name: "Cliente Demo SA de CV",
    tax_id: "ABC010101AB1",
    tax_system: "601",
    address: { zip: "06600" },
    email: "demo@cliente.mx",
  },
  fecha_pago: "2026-06-21",
  forma_pago: "03",
  moneda: "MXN",
  tipo_cambio: 1,
  monto: 1160,
  numero_operacion: "REF-001",
  documento_relacionado: {
    uuid: "11111111-2222-3333-4444-555555555555",
    folio: "100",
    serie: "A",
    moneda_dr: "MXN",
    tipo_cambio_dr: 1,
    num_parcialidad: 1,
    imp_saldo_ant: 1160,
    imp_pagado: 1160,
    imp_saldo_insoluto: 0,
    metodo_pago: "PPD",
    tasa_iva: 0.16,
  },
};

Deno.test("validateRepContext acepta contexto válido", () => {
  assertEquals(validateRepContext(validCtx).length, 0);
});

Deno.test("validateRepContext rechaza RFC inválido", () => {
  const issues = validateRepContext({ ...validCtx, receptor: { ...validCtx.receptor, tax_id: "BAD" } });
  assert(issues.some((i) => i.field === "rfc"));
});

Deno.test("validateRepContext rechaza CP inválido", () => {
  const issues = validateRepContext({ ...validCtx, receptor: { ...validCtx.receptor, address: { zip: "123" } } });
  assert(issues.some((i) => i.field === "codigo_postal"));
});

Deno.test("validateRepContext exige tipo_cambio para moneda ≠ MXN", () => {
  const issues = validateRepContext({ ...validCtx, moneda: "USD", tipo_cambio: 0 });
  assert(issues.some((i) => i.field === "tipo_cambio"));
});

Deno.test("buildRepPayload genera estructura type=P con complemento pago", () => {
  const p = buildRepPayload(validCtx);
  assertEquals(p.type, "P");
  assertEquals(p.complements.length, 1);
  assertEquals(p.complements[0].type, "pago");
  assertEquals(p.complements[0].data[0].related_documents[0].uuid, validCtx.documento_relacionado.uuid);
  assertEquals(p.complements[0].data[0].related_documents[0].installment, 1);
  assertEquals(p.complements[0].data[0].related_documents[0].amount, 1160);
});

Deno.test("buildRepPayload omite exchange cuando moneda == MXN", () => {
  const p = buildRepPayload(validCtx);
  assertEquals(p.complements[0].data[0].exchange, undefined);
});

Deno.test("buildRepPayload incluye exchange cuando moneda USD", () => {
  const p = buildRepPayload({ ...validCtx, moneda: "USD", tipo_cambio: 18.5 });
  assertEquals(p.complements[0].data[0].exchange, 18.5);
});

Deno.test("buildRepPayload invierte el T/C del doc relacionado: pago MXN, factura USD", () => {
  const p = buildRepPayload({
    ...validCtx,
    moneda: "MXN",
    tipo_cambio: 1,
    monto: 23141.03,
    documento_relacionado: {
      ...validCtx.documento_relacionado,
      moneda_dr: "USD",
      tipo_cambio_dr: 17.06,
      imp_saldo_ant: 1356.45,
      imp_pagado: 1356.45,
    },
  });
  const exchange = p.complements[0].data[0].related_documents[0].exchange!;
  // Facturapi exige ≤ 1 cuando el pago es MXN y el documento USD.
  assert(exchange <= 1, `exchange debe ser ≤ 1, fue ${exchange}`);
  assertEquals(exchange, 0.0586166471);
  // Coherencia: monto del pago × factor ≈ importe pagado en la moneda del CFDI.
  assert(Math.abs(23141.03 * exchange - 1356.45) < 0.5);
});

Deno.test("buildRepPayload conserva el T/C cuando el pago es USD y la factura MXN", () => {
  const p = buildRepPayload({
    ...validCtx,
    moneda: "USD",
    tipo_cambio: 17.06,
    documento_relacionado: { ...validCtx.documento_relacionado, moneda_dr: "MXN", tipo_cambio_dr: 1 },
  });
  assertEquals(p.complements[0].data[0].related_documents[0].exchange, 17.06);
});

Deno.test("buildRepPayload omite exchange del doc relacionado si falta el T/C", () => {
  const p = buildRepPayload({
    ...validCtx,
    moneda: "MXN",
    tipo_cambio: 1,
    documento_relacionado: { ...validCtx.documento_relacionado, moneda_dr: "USD", tipo_cambio_dr: 0 },
  });
  assertEquals(p.complements[0].data[0].related_documents[0].exchange, undefined);
});

Deno.test("validateRepContext exige T/C del documento cuando las monedas difieren", () => {
  const issues = validateRepContext({
    ...validCtx,
    documento_relacionado: { ...validCtx.documento_relacionado, moneda_dr: "USD", tipo_cambio_dr: 0 },
  });
  assert(issues.some((i) => i.field === "documento.tipo_cambio_dr"));
});


Deno.test("buildRepPayload incluye numOperacion cuando hay referencia", () => {
  const p = buildRepPayload(validCtx);
  assertEquals(p.complements[0].data[0].numOperacion, "REF-001");
});

Deno.test("buildRepPayload siempre envia taxes: tasa 0% cuando no hay IVA", () => {
  const p = buildRepPayload({
    ...validCtx,
    documento_relacionado: { ...validCtx.documento_relacionado, tasa_iva: 0 },
  });
  const tax = p.complements[0].data[0].related_documents[0].taxes[0];
  assertEquals(tax.rate, 0);
  assertEquals(tax.factor, "Tasa");
  assertEquals(tax.type, "IVA");
});

Deno.test("buildRepPayload declara factor Exento en facturas exentas", () => {
  const p = buildRepPayload({
    ...validCtx,
    documento_relacionado: { ...validCtx.documento_relacionado, tasa_iva: 0, factor_iva: "Exento" },
  });
  const tax = p.complements[0].data[0].related_documents[0].taxes[0];
  assertEquals(tax.factor, "Exento");
  assertEquals(tax.rate, 0);
  assertEquals(tax.base, validCtx.documento_relacionado.imp_pagado);
});

Deno.test("buildRepPayload ignora factor_iva cuando la factura si trae IVA", () => {
  const p = buildRepPayload({
    ...validCtx,
    documento_relacionado: { ...validCtx.documento_relacionado, factor_iva: "Exento" },
  });
  const tax = p.complements[0].data[0].related_documents[0].taxes[0];
  assertEquals(tax.factor, "Tasa");
  assertEquals(tax.rate, 0.16);
});

Deno.test("buildRepPayload incluye base SIN IVA en taxes de documento relacionado", () => {
  const p = buildRepPayload(validCtx);
  const tax = p.complements[0].data[0].related_documents[0].taxes[0];
  // Ola 12 · R3P-18: BaseDR sin IVA → 1160/1.16 = 1000 (ImporteDR = 160.00).
  assertEquals(tax.base, 1000);
  assertEquals(tax.rate, 0.16);
});

Deno.test("buildRepPayload mantiene base = imp_pagado para tasa 0", () => {
  const p = buildRepPayload({
    ...validCtx,
    documento_relacionado: { ...validCtx.documento_relacionado, tasa_iva: 0 },
  });
  const tax = p.complements[0].data[0].related_documents[0].taxes[0];
  assertEquals(tax.base, validCtx.documento_relacionado.imp_pagado);
});

Deno.test("buildRepPayload emite RetencionesDR con la misma BaseDR del traslado", () => {
  // Factura 1,000 + IVA 160 − retención IVA 40 = total 1,120, liquidada.
  const p = buildRepPayload({
    ...validCtx,
    documento_relacionado: {
      ...validCtx.documento_relacionado,
      imp_saldo_ant: 1120,
      imp_pagado: 1120,
      retenciones: [{ tipo: "IVA", tasa: 0.04 }],
      subtotal_factura: 1000,
      total_factura: 1120,
    },
  });
  const taxes = p.complements[0].data[0].related_documents[0].taxes;
  const traslado = taxes.find((t) => !t.withholding)!;
  const ret = taxes.find((t) => t.withholding)!;
  assertEquals(traslado.base, 1000);
  assertEquals(ret.type, "IVA");
  assertEquals(ret.rate, 0.04);
  assertEquals(ret.base, 1000);
});

Deno.test("calcularRetencionesDr agrupa una tasa por impuesto y bloquea mezclas", () => {
  assertEquals(calcularRetencionesDr([{ tasa_ret_iva: 0.04 }, { tasa_ret_iva: 0.04 }]), [
    { tipo: "IVA", tasa: 0.04 },
  ]);
  assertEquals(calcularRetencionesDr([{ tasa_ret_isr: 0.0125 }]), [{ tipo: "ISR", tasa: 0.0125 }]);
  assertEquals(calcularRetencionesDr([]), []);
  assertEquals(calcularRetencionesDr([{ tasa_ret_iva: 0.04 }, { tasa_ret_iva: 0.16 }]), null);
});

Deno.test("factorIvaFacturaOriginal distingue exento, tasa 0 y mezcla", () => {
  assertEquals(factorIvaFacturaOriginal(0.16, ["exento"]), "Tasa");
  assertEquals(factorIvaFacturaOriginal(0, ["exento", "Exento"]), "Exento");
  assertEquals(factorIvaFacturaOriginal(0, ["exento", "tasa0"]), "Tasa");
  assertEquals(factorIvaFacturaOriginal(0, []), "Tasa");
  assertEquals(factorIvaFacturaOriginal(0, null), "Tasa");
  assertEquals(factorIvaFacturaOriginal(0, [null, undefined, "exento"]), "Exento");
});

Deno.test("tasaIvaFacturaOriginal ancla a c_TasaOCuota (R3P-20)", () => {
  assertEquals(tasaIvaFacturaOriginal(1000, 160), 0.16);
  assertEquals(tasaIvaFacturaOriginal(1000, 80), 0.08);
  assertEquals(tasaIvaFacturaOriginal(1000, 0), 0);
  assertEquals(tasaIvaFacturaOriginal(1000, 159.99), 0.16);
  assertEquals(tasaIvaFacturaOriginal(1000, 79.99), 0.08);
  assertEquals(tasaIvaFacturaOriginal(1000, 1.99), 0);
  assertEquals(tasaIvaFacturaOriginal(1000, 120), 0.16);
  assertEquals(tasaIvaFacturaOriginal(1000, 119.99), 0.08);
  assertEquals(tasaIvaFacturaOriginal(0, 0), 0);
  assertEquals(tasaIvaFacturaOriginal(0, 160), 0);
  assertEquals(tasaIvaFacturaOriginal(1000, 100), 0.08);
});


Deno.test("normalizarFormaPago conserva codigos SAT de 2 digitos", () => {
  assertEquals(normalizarFormaPago("03"), "03");
  assertEquals(normalizarFormaPago("28"), "28");
});

Deno.test("normalizarFormaPago mapea nombres legibles a codigos SAT", () => {
  assertEquals(normalizarFormaPago("Transferencia"), "03");
  assertEquals(normalizarFormaPago("Cheque"), "02");
  assertEquals(normalizarFormaPago("Efectivo"), "01");
  assertEquals(normalizarFormaPago("Tarjeta de crédito"), "04");
  assertEquals(normalizarFormaPago("Otro"), "99");
});

Deno.test("normalizarFormaPago sin dato cae en Por definir", () => {
  assertEquals(normalizarFormaPago(null), "99");
  assertEquals(normalizarFormaPago(""), "99");
});

Deno.test("validateRepContext acepta forma de pago legible mapeada", () => {
  const issues = validateRepContext({ ...validCtx, forma_pago: "Transferencia" });
  assertEquals(issues.some((i) => i.field === "forma_pago"), false);
});
