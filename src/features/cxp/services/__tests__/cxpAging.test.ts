/**
 * 13.116.0 (Sprint C) — Tests de la lógica pura de aging CxP.
 * El wrapper RPC se prueba con mock; la suma de cubetas es pura y crítica
 * para el reporte de CxP (un error aquí muestra saldo incorrecto al CFO).
 */
import { describe, it, expect } from "vitest";
import { calcularTotalesAging, type CxpAgingRow } from "../cxpAging";

function row(over: Partial<CxpAgingRow> = {}): CxpAgingRow {
  return {
    proveedor_id: "p",
    proveedor_nombre: "Prov",
    moneda: "MXN",
    saldo_total: 0,
    vigente: 0,
    d_1_30: 0,
    d_31_60: 0,
    d_61_90: 0,
    mas_90: 0,
    num_facturas: 0,
    ...over,
  };
}

describe("calcularTotalesAging", () => {
  it("array vacío → todas las cubetas en 0", () => {
    expect(calcularTotalesAging([])).toEqual({
      vigente: 0, d_1_30: 0, d_31_60: 0, d_61_90: 0, mas_90: 0, total: 0,
    });
  });

  it("suma cubetas por proveedor sin mezclarlas", () => {
    const tot = calcularTotalesAging([
      row({ vigente: 100, d_1_30: 50, saldo_total: 150 }),
      row({ d_31_60: 200, mas_90: 80, saldo_total: 280 }),
    ]);
    expect(tot).toEqual({
      vigente: 100, d_1_30: 50, d_31_60: 200, d_61_90: 0, mas_90: 80, total: 430,
    });
  });

  it("preserva precisión con decimales (no pierde centavos)", () => {
    const tot = calcularTotalesAging([
      row({ vigente: 100.10, saldo_total: 100.10 }),
      row({ vigente: 200.25, saldo_total: 200.25 }),
    ]);
    expect(tot.vigente).toBeCloseTo(300.35, 2);
    expect(tot.total).toBeCloseTo(300.35, 2);
  });

  it("total agregado refleja saldo_total, no suma de cubetas (puede divergir si hay datos sucios)", () => {
    // Invariante: usamos saldo_total como fuente de verdad porque la RPC ya
    // hace el corte por fecha. Si total fuera suma de cubetas, una migración
    // que añada una nueva cubeta dejaría totales mal hasta que se actualice
    // este helper.
    const tot = calcularTotalesAging([
      row({ vigente: 100, d_1_30: 50, saldo_total: 999 }),
    ]);
    expect(tot.total).toBe(999);
    expect(tot.vigente + tot.d_1_30).toBe(150);
  });
});
