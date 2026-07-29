import { describe, it, expect } from "vitest";
import { calcularSaldoFactura } from "@/lib/financial/saldoFactura";

describe("calcularSaldoFactura (canon A1)", () => {
  it("resta pagos y notas de crédito aplicadas", () => {
    const r = calcularSaldoFactura(1000, [{ monto_aplicado_factura: 300 }], [{ monto: 200 }]);
    expect(r.pagado).toBe(300);
    expect(r.notasCredito).toBe(200);
    expect(r.saldo).toBe(500);
    expect(r.liquidada).toBe(false);
  });

  it("marca liquidada cuando NC + pagos cubren el total", () => {
    const r = calcularSaldoFactura(1000, [{ monto_aplicado_factura: "600" }], [{ monto: "400" }]);
    expect(r.saldo).toBe(0);
    expect(r.liquidada).toBe(true);
  });

  it("nunca devuelve saldo negativo", () => {
    expect(calcularSaldoFactura(100, [{ monto_aplicado_factura: 500 }]).saldo).toBe(0);
  });

  it("tolera valores nulos o no numéricos", () => {
    const r = calcularSaldoFactura(500, [{ monto_aplicado_factura: null }], [{ monto: undefined }]);
    expect(r.saldo).toBe(500);
  });
});
