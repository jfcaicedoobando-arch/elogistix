import { describe, it, expect } from "vitest";
import { calcularSaldoFacturaPortal } from "../facturaSaldo";

describe("calcularSaldoFacturaPortal (B-082)", () => {
  it("descuenta pagos y notas de crédito aplicadas", () => {
    const r = calcularSaldoFacturaPortal(
      11600,
      [{ monto_aplicado_factura: 5000 }, { monto_aplicado_factura: "1000" }],
      [{ monto: 600 }],
    );
    expect(r.pagado).toBe(6000);
    expect(r.notasCredito).toBe(600);
    expect(r.saldo).toBe(5000);
    expect(r.liquidada).toBe(false);
  });

  it("marca liquidada cuando la NC cubre el remanente", () => {
    const r = calcularSaldoFacturaPortal(1000, [{ monto_aplicado_factura: 400 }], [{ monto: 600 }]);
    expect(r.saldo).toBe(0);
    expect(r.liquidada).toBe(true);
  });

  it("nunca devuelve saldo negativo por sobrepago", () => {
    const r = calcularSaldoFacturaPortal(1000, [{ monto_aplicado_factura: 1500 }]);
    expect(r.saldo).toBe(0);
    expect(r.liquidada).toBe(true);
  });

  it("tolera valores nulos o no numéricos", () => {
    const r = calcularSaldoFacturaPortal(1000, [{ monto_aplicado_factura: null }], [{ monto: "x" }]);
    expect(r.saldo).toBe(1000);
    expect(r.pagado).toBe(0);
    expect(r.notasCredito).toBe(0);
  });

  it("sin movimientos, el saldo es el total", () => {
    const r = calcularSaldoFacturaPortal(2500);
    expect(r).toMatchObject({ total: 2500, pagado: 0, notasCredito: 0, saldo: 2500 });
  });
});
