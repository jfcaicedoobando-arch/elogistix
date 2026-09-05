import { describe, it, expect } from "vitest";
import { calcularSaldoFactura, esEstadoSinSaldo } from "@/lib/financial/saldoFactura";

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

  it("tolera pagos y notas de crédito con montos nulos o no numéricos", () => {
    const r = calcularSaldoFactura(500, [{ monto_aplicado_factura: null }], [{ monto: undefined }]);
    expect(r.saldo).toBe(500);
  });

  // BUG-2026-08-25: facturas legacy marcadas Pagada sin pagos capturados.
  it.each(["Pagada", "Cancelada", "Sustituida"])(
    "devuelve saldo 0 en estado terminal %s aunque no haya pagos",
    (estado) => {
      const r = calcularSaldoFactura(1000, [], [], estado);
      expect(r.saldo).toBe(0);
      expect(r.liquidada).toBe(true);
      expect(r.total).toBe(1000);
    },
  );

  // v13.823.145: un CFDI sin timbrar sigue pendiente por cobrar.
  it("conserva el saldo en Borrador (sin timbrar)", () => {
    const r = calcularSaldoFactura(1000, [], [], "Borrador");
    expect(r.saldo).toBe(1000);
    expect(r.liquidada).toBe(false);
  });

  it("conserva el saldo en estados vivos", () => {
    expect(calcularSaldoFactura(1000, [], [], "Emitida").saldo).toBe(1000);
    expect(calcularSaldoFactura(1000, [], [], "Parcialmente pagada").saldo).toBe(1000);
    expect(calcularSaldoFactura(1000, [], [], "Vencida").saldo).toBe(1000);
  });
});

describe("esEstadoSinSaldo", () => {
  it("sólo reconoce los estados terminales", () => {
    expect(esEstadoSinSaldo("Pagada")).toBe(true);
    expect(esEstadoSinSaldo("Emitida")).toBe(false);
    expect(esEstadoSinSaldo(null)).toBe(false);
    expect(esEstadoSinSaldo(undefined)).toBe(false);
  });
});

