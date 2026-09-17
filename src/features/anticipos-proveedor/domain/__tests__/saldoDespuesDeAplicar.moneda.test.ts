/**
 * MNY P2.4 — el resumen de aplicación no puede restar 100 USD a un saldo en
 * MXN/EUR como si fueran la misma moneda; convierte al DOF de la fecha elegida
 * y sin paridad no muestra cifra.
 */
import { describe, it, expect } from "vitest";
import { calcularSaldoDespuesDeAplicar } from "../saldoDespuesDeAplicar";

const tc = { usdMxn: 18, eurMxn: 20.7692, fecha: "2026-09-16", exacto: true };

describe("calcularSaldoDespuesDeAplicar · monedas distintas", () => {
  it("misma moneda resta el monto tal cual", () => {
    const r = calcularSaldoDespuesDeAplicar({
      saldoFactura: 1000,
      montoAplicar: 400,
      monedaFactura: "MXN",
      monedaAnticipo: "MXN",
      tc,
    });
    expect(r.saldoRestante).toBe(600);
    expect(r.estimado).toBe(false);
    expect(r.montoEnMonedaFactura).toBe(400);
  });

  it("USD → MXN convierte con la paridad DOF", () => {
    const r = calcularSaldoDespuesDeAplicar({
      saldoFactura: 5000,
      montoAplicar: 100,
      monedaFactura: "MXN",
      monedaAnticipo: "USD",
      tc,
    });
    expect(r.montoEnMonedaFactura).toBeCloseTo(1800, 2);
    expect(r.saldoRestante).toBeCloseTo(3200, 2);
    expect(r.estimado).toBe(true);
    // Con monedas distintas nunca se afirma que la factura queda cubierta.
    expect(r.quedaCubierta).toBe(false);
  });

  it("USD → EUR cruza vía MXN (100 USD = 86.6850 EUR al DOF de control)", () => {
    const r = calcularSaldoDespuesDeAplicar({
      saldoFactura: 500,
      montoAplicar: 100,
      monedaFactura: "EUR",
      monedaAnticipo: "USD",
      tc,
    });
    expect(r.montoEnMonedaFactura).toBeCloseTo(86.685, 2);
    expect(r.saldoRestante).toBeCloseTo(413.315, 2);
  });

  it("sin paridad no inventa saldo", () => {
    const r = calcularSaldoDespuesDeAplicar({
      saldoFactura: 500,
      montoAplicar: 100,
      monedaFactura: "EUR",
      monedaAnticipo: "USD",
      tc: null,
    });
    expect(r.sinTipoCambio).toBe(true);
    expect(r.saldoRestante).toBeNull();
    expect(r.montoEnMonedaFactura).toBeNull();
  });

  it("marca excedente cuando lo convertido supera el saldo", () => {
    const r = calcularSaldoDespuesDeAplicar({
      saldoFactura: 1000,
      montoAplicar: 100,
      monedaFactura: "MXN",
      monedaAnticipo: "USD",
      tc,
    });
    expect(r.excedente).toBeCloseTo(800, 2);
    expect(r.saldoRestante).toBe(0);
  });
});
