/**
 * Fase 4 UI/UX — cobertura de los KPIs financieros derivados (DSO/DPO/Runway).
 */
import { describe, it, expect } from "vitest";
import { calcularKPIsEjecutivos } from "../alertas";
import type { SnapshotEjecutivo } from "../types";

function snap(over: Record<string, unknown> = {}) {
  return {
    periodo: "2026-07",
    eerrPeriodo: {
      totalIngresos: { total: 100_000, mxn: 100_000, usd: 0 },
      totalCostos: { total: 60_000, mxn: 60_000, usd: 0 },
      utilidad: { total: 40_000, mxn: 40_000, usd: 0 },
      margen: 40, ingresos: [], costos: [],
    },
    eerr12m: [],
    tesoreria: {
      cuentas: [{ id: "b1", nombre: "BBVA", saldo: 100_000, moneda: "MXN" }],
      flujo: {
        por_cobrar_mxn: 50_000, por_cobrar_usd: 0,
        por_pagar_mxn: 30_000, por_pagar_usd: 0,
        flujo_neto_mxn: 20_000, flujo_neto_usd: 0,
      },
      top_deudores: [], top_acreedores: [],
    },
    presupuesto: {
      periodo: "2026-07", filas: [],
      total_presupuesto_mxn: 0, total_real_mxn: 0, variacion_neta_mxn: 0,
    },
    flujo: {
      saldo_inicial_mxn: 0, semanas: [],
      total_entradas_mxn: 0, total_salidas_mxn: 0,
      saldo_final_mxn: 0, alertas_negativas: 0,
    },
    ...over,
  } as unknown as Omit<SnapshotEjecutivo, "kpis" | "alertas" | "topDeudores" | "topAcreedores" | "generadoEn">;
}

describe("calcularKPIsEjecutivos · DSO / DPO / Runway (Fase 4)", () => {
  it("DSO = CxC 30d / ingresos × 30", () => {
    const k = calcularKPIsEjecutivos(snap(), 0);
    expect(k.dso_dias).toBeCloseTo((50_000 / 100_000) * 30, 5); // 15
  });

  it("DPO = CxP 30d / costos × 30", () => {
    const k = calcularKPIsEjecutivos(snap(), 0);
    expect(k.dpo_dias).toBeCloseTo((30_000 / 60_000) * 30, 5); // 15
  });

  it("DSO/DPO son null cuando no hay ingresos/costos", () => {
    const k = calcularKPIsEjecutivos(
      snap({
        eerrPeriodo: {
          totalIngresos: { total: 0, mxn: 0, usd: 0 },
          totalCostos: { total: 0, mxn: 0, usd: 0 },
          utilidad: { total: 0, mxn: 0, usd: 0 },
          margen: 0, ingresos: [], costos: [],
        },
      }),
      0,
    );
    expect(k.dso_dias).toBeNull();
    expect(k.dpo_dias).toBeNull();
  });

  it("Runway es null cuando la utilidad es ≥ 0 (sin burn)", () => {
    const k = calcularKPIsEjecutivos(snap(), 0);
    expect(k.runway_meses).toBeNull();
  });

  it("Runway = bancos / (costos − ingresos) cuando hay pérdida", () => {
    const k = calcularKPIsEjecutivos(
      snap({
        eerrPeriodo: {
          totalIngresos: { total: 50_000, mxn: 50_000, usd: 0 },
          totalCostos: { total: 100_000, mxn: 100_000, usd: 0 },
          utilidad: { total: -50_000, mxn: -50_000, usd: 0 },
          margen: -100, ingresos: [], costos: [],
        },
      }),
      0,
    );
    // burn = 50_000, bancos = 100_000 → 2 meses
    expect(k.runway_meses).toBeCloseTo(2, 5);
  });

  it("Runway es null si no hay saldo en bancos", () => {
    const k = calcularKPIsEjecutivos(
      snap({
        eerrPeriodo: {
          totalIngresos: { total: 50_000, mxn: 50_000, usd: 0 },
          totalCostos: { total: 100_000, mxn: 100_000, usd: 0 },
          utilidad: { total: -50_000, mxn: -50_000, usd: 0 },
          margen: -100, ingresos: [], costos: [],
        },
        tesoreria: {
          cuentas: [], // sin saldo
          flujo: {
            por_cobrar_mxn: 0, por_cobrar_usd: 0,
            por_pagar_mxn: 0, por_pagar_usd: 0,
            flujo_neto_mxn: 0, flujo_neto_usd: 0,
          },
          top_deudores: [], top_acreedores: [],
        },
      }),
      0,
    );
    expect(k.runway_meses).toBeNull();
  });
});
