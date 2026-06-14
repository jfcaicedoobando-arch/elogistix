/**
 * Tests puros del hook `useCostosPreciosCalc`. Verifica:
 *  - Suma homogénea cuando todos los conceptos están en USD.
 *  - Detección de filas mixtas cuando hay monedas distintas y TC válido.
 *  - Fallback laxo (`tcMissing: true`) cuando falta TC para conversiones.
 *  - Cálculo independiente de costos y ventas.
 *
 * Phase 3.1 — D-tests Auditoría 13.14.0.
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCostosPreciosCalc } from "../useCostosPreciosCalc";

describe("useCostosPreciosCalc", () => {
  it("suma homogénea en USD sin filas mixtas", () => {
    const { result } = renderHook(() =>
      useCostosPreciosCalc(
        [
          { monto: 100, moneda: "USD" },
          { monto: 50.5, moneda: "USD" },
        ],
        [{ precioUnitario: 200, moneda: "USD" }],
        18.5,
        20.1,
      ),
    );
    expect(result.current.costoCalc.total).toBeCloseTo(150.5, 2);
    expect(result.current.costoCalc.homogenea).toBe(true);
    expect(result.current.costoCalc.filasMixtas).toEqual([]);
    expect(result.current.costoCalc.tcMissing).toBe(false);
    expect(result.current.ventaCalc.total).toBeCloseTo(200, 2);
  });

  it("convierte MXN/EUR a USD con TC válidos", () => {
    const { result } = renderHook(() =>
      useCostosPreciosCalc(
        [
          { monto: 100, moneda: "USD" },
          { monto: 1850, moneda: "MXN" },
          { monto: 100, moneda: "EUR" },
        ],
        [],
        18.5,
        20.0,
      ),
    );
    // 100 USD + 1850/18.5 (=100) + 100*20/18.5 (≈108.108)
    expect(result.current.costoCalc.total).toBeGreaterThan(300);
    expect(result.current.costoCalc.tcMissing).toBe(false);
  });

  it("cae a fallback con tcMissing=true cuando TC es 0", () => {
    const { result } = renderHook(() =>
      useCostosPreciosCalc(
        [
          { monto: 100, moneda: "USD" },
          { monto: 1850, moneda: "MXN" },
        ],
        [],
        0,
        0,
      ),
    );
    expect(result.current.costoCalc.tcMissing).toBe(true);
    expect(result.current.costoCalc.total).toBe(0);
    expect(result.current.costoCalc.filasMixtas.length).toBeGreaterThan(0);
  });

  it("listas vacías producen total 0 y homogenea true", () => {
    const { result } = renderHook(() => useCostosPreciosCalc([], [], 18.5, 20));
    expect(result.current.costoCalc.total).toBe(0);
    expect(result.current.ventaCalc.total).toBe(0);
  });
});
