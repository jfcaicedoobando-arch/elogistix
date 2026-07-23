import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildRepPayload, validateRepContext, normalizarFormaPago, type PagoContext } from "./helpers.ts";

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

Deno.test("buildRepPayload incluye exchange en doc relacionado si difiere de la moneda del pago", () => {
  const p = buildRepPayload({
    ...validCtx,
    moneda: "MXN",
    tipo_cambio: 1,
    documento_relacionado: { ...validCtx.documento_relacionado, moneda_dr: "USD", tipo_cambio_dr: 18.5 },
  });
  assertEquals(p.complements[0].data[0].related_documents[0].exchange, 18.5);
});

Deno.test("buildRepPayload incluye numOperacion cuando hay referencia", () => {
  const p = buildRepPayload(validCtx);
  assertEquals(p.complements[0].data[0].numOperacion, "REF-001");
});

Deno.test("buildRepPayload omite taxes cuando tasa_iva = 0", () => {
  const p = buildRepPayload({
    ...validCtx,
    documento_relacionado: { ...validCtx.documento_relacionado, tasa_iva: 0 },
  });
  assertEquals(p.complements[0].data[0].related_documents[0].taxes, undefined);
});

Deno.test("buildRepPayload incluye base en taxes de documento relacionado", () => {
  const p = buildRepPayload(validCtx);
  const tax = p.complements[0].data[0].related_documents[0].taxes![0];
  assertEquals(tax.base, 1160);
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
