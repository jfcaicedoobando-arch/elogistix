import { describe, expect, it } from "vitest";
import {
  importeMovimiento,
  montosCuadran,
  TOLERANCIA_CONCILIACION,
} from "../conciliacionMonto";

describe("importeMovimiento", () => {
  it("toma el abono cuando el movimiento es un depósito", () => {
    expect(importeMovimiento({ cargo: null, abono: 1500.5 })).toBe(1500.5);
  });

  it("toma el cargo cuando el movimiento es un retiro", () => {
    expect(importeMovimiento({ cargo: "980.25", abono: null })).toBe(980.25);
  });

  it("devuelve 0 si el movimiento no trae importes", () => {
    expect(importeMovimiento({ cargo: null, abono: null })).toBe(0);
  });
});

describe("montosCuadran", () => {
  it("acepta importes idénticos", () => {
    expect(montosCuadran(10000, 10000)).toBe(true);
  });

  it("acepta diferencias dentro de la tolerancia de centavos", () => {
    expect(montosCuadran(10000, 10000 - TOLERANCIA_CONCILIACION)).toBe(true);
  });

  it("rechaza un depósito de 100 contra un pago de 10,000 (N11)", () => {
    expect(montosCuadran(100, 10000)).toBe(false);
  });

  it("rechaza diferencias mayores a la tolerancia", () => {
    expect(montosCuadran(10000, 10001.5)).toBe(false);
  });

  it("no bloquea cuando falta alguno de los importes", () => {
    expect(montosCuadran(0, 10000)).toBe(true);
    expect(montosCuadran(10000, 0)).toBe(true);
  });
});
