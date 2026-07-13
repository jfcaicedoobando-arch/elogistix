import { describe, it, expect } from "vitest";
import type { DimensionLCL } from "@/features/cotizacion/types/core";
import {
  calcularTotalesLcl,
  calcularFleteVentaLCL,
} from "../calcularWMLcl";

const dim = (piezas: number, volumen_m3: number): DimensionLCL => ({
  piezas, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3,
});

describe("calcularTotalesLcl", () => {
  it("devuelve ceros cuando no hay filas ni peso", () => {
    expect(calcularTotalesLcl(undefined, undefined)).toEqual({
      totalPiezas: 0, totalVolumenM3: 0, totalPesoKg: 0, wmFacturable: 0,
    });
    expect(calcularTotalesLcl([], 0)).toEqual({
      totalPiezas: 0, totalVolumenM3: 0, totalPesoKg: 0, wmFacturable: 0,
    });
  });

  it("W/M = volumen cuando volumen > peso/1000", () => {
    const r = calcularTotalesLcl([dim(5, 3.5), dim(2, 1.2)], 800);
    expect(r.totalPiezas).toBe(7);
    expect(r.totalVolumenM3).toBe(4.7);
    expect(r.totalPesoKg).toBe(800);
    expect(r.wmFacturable).toBe(4.7); // 0.8 vs 4.7
  });

  it("W/M = peso/1000 cuando peso/1000 > volumen", () => {
    const r = calcularTotalesLcl([dim(1, 0.8)], 2500);
    expect(r.wmFacturable).toBe(2.5); // 2.5 vs 0.8
  });

  it("ignora valores no finitos", () => {
    const r = calcularTotalesLcl([dim(NaN as unknown as number, 2)], -50);
    expect(r.totalPiezas).toBe(0);
    expect(r.totalPesoKg).toBe(0);
    expect(r.wmFacturable).toBe(2);
  });
});

describe("calcularFleteVentaLCL", () => {
  it("aplica max(wm×tarifa, minimo)", () => {
    expect(calcularFleteVentaLCL(3, 55, 200)).toBe(200); // 165 < 200
    expect(calcularFleteVentaLCL(10, 55, 200)).toBe(550); // 550 > 200
  });

  it("redondea a 2 decimales", () => {
    expect(calcularFleteVentaLCL(1.234, 45.67, 0)).toBe(56.36);
  });

  it("devuelve 0 con entradas inválidas", () => {
    expect(calcularFleteVentaLCL(0, 0, 0)).toBe(0);
    expect(calcularFleteVentaLCL(NaN, 55, 0)).toBe(0);
  });
});
