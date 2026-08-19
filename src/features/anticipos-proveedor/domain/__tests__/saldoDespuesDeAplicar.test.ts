import { describe, expect, it } from "vitest";
import { calcularSaldoDespuesDeAplicar } from "../saldoDespuesDeAplicar";

describe("calcularSaldoDespuesDeAplicar", () => {
  it("cubre la factura cuando la moneda coincide y el monto alcanza", () => {
    const r = calcularSaldoDespuesDeAplicar({
      saldoFactura: 1000, montoAplicar: 1000, monedaFactura: "MXN", monedaAnticipo: "MXN",
    });
    expect(r).toMatchObject({ saldoRestante: 0, excedente: 0, estimado: false, quedaCubierta: true });
  });

  it("BL-13: con monedas distintas nunca afirma que queda cubierta", () => {
    const r = calcularSaldoDespuesDeAplicar({
      saldoFactura: 1000, montoAplicar: 1000, monedaFactura: "USD", monedaAnticipo: "MXN",
    });
    expect(r.estimado).toBe(true);
    expect(r.quedaCubierta).toBe(false);
  });

  it("reporta excedente y nunca saldos negativos", () => {
    const r = calcularSaldoDespuesDeAplicar({
      saldoFactura: 500, montoAplicar: 800, monedaFactura: "MXN", monedaAnticipo: "MXN",
    });
    expect(r.saldoRestante).toBe(0);
    expect(r.excedente).toBe(300);
  });

  it("sanea valores no finitos o negativos", () => {
    const r = calcularSaldoDespuesDeAplicar({
      saldoFactura: Number.NaN, montoAplicar: -50, monedaFactura: "MXN", monedaAnticipo: "MXN",
    });
    expect(r.saldoRestante).toBe(0);
    expect(r.excedente).toBe(0);
  });
});
