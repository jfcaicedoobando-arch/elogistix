/**
 * v13.823.295 — Un pago cuyo REP quedó cancelado ante el SAT está ANULADO:
 * no suma a cobrado ni reduce el saldo (espejo de `saldo_factura_bruto`).
 */
import { describe, it, expect } from "vitest";
import { calcularSaldoFactura, esPagoAnulado } from "../saldoFactura";

describe("calcularSaldoFactura · pagos con REP cancelado", () => {
  it("ignora el pago anulado (caso factura 1015)", () => {
    const r = calcularSaldoFactura(
      17910,
      [{ monto_aplicado_factura: 17910, estado_rep: "Cancelado" }],
      [],
      "Vencida",
    );
    expect(r.pagado).toBe(0);
    expect(r.saldo).toBe(17910);
    expect(r.liquidada).toBe(false);
  });

  it("suma sólo los pagos vigentes cuando hay mezcla", () => {
    const r = calcularSaldoFactura(
      1000,
      [
        { monto_aplicado_factura: 400, estado_rep: "Timbrado" },
        { monto_aplicado_factura: 600, estado_rep: "Cancelado" },
      ],
      [],
      "Emitida",
    );
    expect(r.pagado).toBe(400);
    expect(r.saldo).toBe(600);
  });

  it("considera vigente el pago cuando la lectura no trae estado_rep", () => {
    const r = calcularSaldoFactura(1000, [{ monto_aplicado_factura: 1000 }], [], "Emitida");
    expect(r.pagado).toBe(1000);
    expect(r.saldo).toBe(0);
  });

  it("es tolerante a variantes de texto del estado", () => {
    expect(esPagoAnulado({ estado_rep: " cancelado " })).toBe(true);
    expect(esPagoAnulado({ estado_rep: "Timbrado" })).toBe(false);
    expect(esPagoAnulado({ estado_rep: null })).toBe(false);
    expect(esPagoAnulado({})).toBe(false);
  });
});
