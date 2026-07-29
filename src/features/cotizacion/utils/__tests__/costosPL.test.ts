/**
 * Q-15.9 — Regresión de captura de costos en el wizard de cotización.
 * Caso reportado: teclear 15000 arrojaba un total de 292,500,000 porque la
 * cantidad admitía valores sin tope y el multiplicador no era visible.
 */
import { describe, it, expect } from "vitest";
import { parseCantidad, parseInputNumero, CANTIDAD_MAX } from "../parseInputNumero";
import { calcTotalsPL } from "@/features/cotizacion/components/costosPLTypes";

describe("parseCantidad", () => {
  it("acepta separador de miles", () => {
    expect(parseCantidad("15,000")).toBe(CANTIDAD_MAX);
    expect(parseCantidad("1,500")).toBe(1_500);
  });

  it("limita la cantidad al tope permitido", () => {
    expect(parseCantidad("999999")).toBe(CANTIDAD_MAX);
  });

  it("degrada string vacío y negativos a 0", () => {
    expect(parseCantidad("")).toBe(0);
    expect(parseCantidad("-5")).toBe(0);
    expect(parseInputNumero("abc")).toBe(0);
  });
});

describe("calcTotalsPL", () => {
  const fila = (cantidad: number, costo: number, ventaTotal: number) => ({ cantidad, costo, venta: ventaTotal });

  it("cantidad 1 no multiplica de más", () => {
    const r = calcTotalsPL([fila(1, 15_000, 19_500)]);
    expect(r.totalCosto).toBe(15_000);
    expect(r.totalVenta).toBe(19_500);
    expect(r.profit).toBe(4_500);
  });

  it("cantidad 3 multiplica una sola vez", () => {
    const r = calcTotalsPL([fila(3, 15_000, 58_500)]);
    expect(r.totalCosto).toBe(45_000);
    expect(r.totalVenta).toBe(58_500);
  });

  it("cantidad 0 no rompe el cálculo", () => {
    const r = calcTotalsPL([fila(0, 15_000, 0)]);
    expect(r.totalCosto).toBe(0);
    expect(r.totalVenta).toBe(0);
  });

  it("nunca produce el total erróneo de 292,500,000", () => {
    const r = calcTotalsPL([fila(parseCantidad("15,000"), 0, 0)]);
    expect(r.totalCosto).toBe(0);
    expect(calcTotalsPL([fila(1, 15_000, 19_500)]).totalCosto).not.toBe(292_500_000);
  });
});
