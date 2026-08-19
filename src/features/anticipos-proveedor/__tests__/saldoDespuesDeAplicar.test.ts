import { describe, it, expect } from "vitest";
import { calcularSaldoDespuesDeAplicar } from "@/features/anticipos-proveedor/domain/saldoDespuesDeAplicar";

const base = { monedaFactura: "MXN", monedaAnticipo: "MXN" };

describe("calcularSaldoDespuesDeAplicar (anticipos-proveedor · UI)", () => {
  it("cubre la factura cuando el monto iguala el saldo", () => {
    const r = calcularSaldoDespuesDeAplicar({ ...base, saldoFactura: 1160, montoAplicar: 1160 });
    expect(r.saldoRestante).toBe(0);
    expect(r.excedente).toBe(0);
    expect(r.quedaCubierta).toBe(true);
    expect(r.estimado).toBe(false);
  });

  it("deja saldo restante en aplicación parcial", () => {
    const r = calcularSaldoDespuesDeAplicar({ ...base, saldoFactura: 1160, montoAplicar: 400 });
    expect(r.saldoRestante).toBe(760);
    expect(r.quedaCubierta).toBe(false);
  });

  it("reporta excedente sin dejar saldo negativo", () => {
    const r = calcularSaldoDespuesDeAplicar({ ...base, saldoFactura: 1000, montoAplicar: 1500 });
    expect(r.saldoRestante).toBe(0);
    expect(r.excedente).toBe(500);
  });

  it("marca estimado cuando la moneda del anticipo difiere", () => {
    const r = calcularSaldoDespuesDeAplicar({
      saldoFactura: 1000, montoAplicar: 50, monedaFactura: "MXN", monedaAnticipo: "USD",
    });
    expect(r.estimado).toBe(true);
  });

  it("tolera montos no numéricos", () => {
    const r = calcularSaldoDespuesDeAplicar({ ...base, saldoFactura: 500, montoAplicar: Number.NaN });
    expect(r.saldoRestante).toBe(500);
  });
});
