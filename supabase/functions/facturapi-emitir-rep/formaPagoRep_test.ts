import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildRepPayload,
  formaPagoRepObligatoria,
  MSG_REP_FORMA_PAGO_INVALIDA,
  normalizarFormaPago,
  validateRepContext,
  type PagoContext,
} from "./helpers.ts";

function ctx(formaPago: string | null): PagoContext {
  return {
    receptor: {
      legal_name: "Cliente Demo SA de CV",
      tax_id: "AAA010101AAA",
      tax_system: "601",
      address: { zip: "44100" },
    },
    fecha_pago: "2026-09-18",
    forma_pago: formaPago ?? "",
    moneda: "MXN",
    tipo_cambio: 1,
    monto: 1160,
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
    },
  };
}

Deno.test("normalizarFormaPago NO inventa 99 para un pago ya recibido", () => {
  assertEquals(normalizarFormaPago(null), null);
  assertEquals(normalizarFormaPago(""), null);
  assertEquals(normalizarFormaPago("  "), null);
  assertEquals(normalizarFormaPago("Otro"), null);
  assertEquals(normalizarFormaPago("99"), null);
  assertEquals(normalizarFormaPago("77"), null);
});

Deno.test("normalizarFormaPago conserva claves y mapeos validos", () => {
  assertEquals(normalizarFormaPago("03"), "03");
  assertEquals(normalizarFormaPago("28"), "28");
  assertEquals(normalizarFormaPago("Transferencia"), "03");
  assertEquals(normalizarFormaPago("Cheque"), "02");
  assertEquals(normalizarFormaPago("Efectivo"), "01");
  assertEquals(normalizarFormaPago("Tarjeta de crédito"), "04");
  assertEquals(normalizarFormaPago("Tarjeta de débito"), "28");
});

Deno.test("validateRepContext rechaza forma ausente, desconocida, Otro y 99", () => {
  for (const valor of [null, "", "Otro", "99", "77"]) {
    const issues = validateRepContext(ctx(valor));
    assertEquals(
      issues.some((i) => i.field === "forma_pago" && i.message === MSG_REP_FORMA_PAGO_INVALIDA),
      true,
      `esperaba bloqueo para ${String(valor)}`,
    );
  }
});

Deno.test("validateRepContext acepta una forma real del catalogo", () => {
  assertEquals(validateRepContext(ctx("03")), []);
  assertEquals(validateRepContext(ctx("Transferencia")), []);
});

Deno.test("el payload lleva la clave validada y nunca 99", () => {
  const payload = buildRepPayload(ctx("Transferencia"));
  assertEquals(payload.complements[0].data[0].payment_form, "03");
  assertThrows(() => formaPagoRepObligatoria("99"), Error, "c_FormaPago");
  assertThrows(() => buildRepPayload(ctx("99")));
});
