/**
 * 13.116.0 (Sprint C) — Tests de la lógica pura de aging CxP.
 * El wrapper RPC se prueba con mock; la suma de cubetas es pura y crítica
 * para el reporte de CxP (un error aquí muestra saldo incorrecto al CFO).
 */
import { describe, it, expect } from "vitest";
import {
  calcularTotalesAging,
  calcularTotalesPorMoneda,
  monedasPresentes,
  type CxpAgingRow,
} from "../cxpAging";

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


// v13.315.9 (QW3) — la RPC ahora devuelve una fila por moneda; el aging debe
// separar MXN/USD/EUR para no reportar saldos económicamente incorrectos.
describe("QW3 · segmentación por moneda", () => {
  it("calcularTotalesPorMoneda agrupa por moneda sin mezclar cubetas", () => {
    const mapa = calcularTotalesPorMoneda([
      row({ moneda: "MXN", vigente: 100, saldo_total: 100 }),
      row({ moneda: "MXN", d_1_30: 50, saldo_total: 50 }),
      row({ moneda: "USD", vigente: 20, saldo_total: 20 }),
      row({ moneda: "EUR", mas_90: 5, saldo_total: 5 }),
    ]);
    expect(mapa.MXN.total).toBe(150);
    expect(mapa.MXN.vigente).toBe(100);
    expect(mapa.MXN.d_1_30).toBe(50);
    expect(mapa.USD.total).toBe(20);
    expect(mapa.EUR.mas_90).toBe(5);
    // USD no debe recibir nada de MXN
    expect(mapa.USD.d_1_30).toBe(0);
  });

  it("monedasPresentes ordena MXN → USD → EUR primero y luego alfabético", () => {
    const monedas = monedasPresentes([
      row({ moneda: "EUR" }),
      row({ moneda: "GBP" }),
      row({ moneda: "USD" }),
      row({ moneda: "MXN" }),
    ]);
    expect(monedas).toEqual(["MXN", "USD", "EUR", "GBP"]);
  });

  it("monedasPresentes devuelve arreglo vacío si no hay filas", () => {
    expect(monedasPresentes([])).toEqual([]);
  });
});
