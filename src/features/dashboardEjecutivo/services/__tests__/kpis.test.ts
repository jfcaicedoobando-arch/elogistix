/**
 * Blindaje de Batch A: calcularKPIsEjecutivos debe reportar en
 * `cartera_vencida_mxn` únicamente deudores con dias > 30 (antes sumaba
 * TODA la cartera y contradecía la alerta `cartera-vencida-alta`).
 */
import { describe, it, expect } from "vitest";
import { calcularKPIsEjecutivos } from "../alertas";
import type { SnapshotEjecutivo } from "../types";

function baseSnapshot(over: Partial<Parameters<typeof calcularKPIsEjecutivos>[0]> = {}) {
  return {
    periodo: "2026-07",
    fuente: "embarques" as const,
    eerrPeriodo: {
      totalIngresos: { total: 100_000, mxn: 100_000, usd: 0 },
      totalCostos: { total: 60_000, mxn: 60_000, usd: 0 },
      utilidad: { total: 40_000, mxn: 40_000, usd: 0 },
      margen: 40,
      ingresos: [],
      costos: [],
    },
    eerr12m: [],
    ingresosPrevios: 0,
    tesoreria: {
      cuentas: [{ id: "b1", nombre: "BBVA", saldo: 500_000, moneda: "MXN" }],
      flujo: {
        por_cobrar_mxn: 0, por_cobrar_usd: 0,
        por_pagar_mxn: 0, por_pagar_usd: 0,
        flujo_neto_mxn: 0, flujo_neto_usd: 0,
      },
      top_deudores: [],
      top_acreedores: [],
    },
    presupuesto: {
      periodo: "2026-07",
      filas: [],
      total_presupuesto_mxn: 0,
      total_real_mxn: 0,
      variacion_neta_mxn: 0,
    },
    flujo: {
      saldo_inicial_mxn: 0,
      semanas: [],
      total_entradas_mxn: 0,
      total_salidas_mxn: 0,
      saldo_final_mxn: 0,
      alertas_negativas: 0,
    },
    ...over,
  } as unknown as Omit<SnapshotEjecutivo, "kpis" | "alertas" | "topDeudores" | "topAcreedores" | "generadoEn">;
}

describe("calcularKPIsEjecutivos · cartera vencida", () => {
  it("suma sólo deudores con dias > 30", () => {
    const snap = baseSnapshot({
      tesoreria: {
        cuentas: [],
        flujo: {
          por_cobrar_mxn: 0, por_cobrar_usd: 0,
          por_pagar_mxn: 0, por_pagar_usd: 0,
          flujo_neto_mxn: 0, flujo_neto_usd: 0,
        },
        top_deudores: [
          { nombre: "A", saldo: 10_000, moneda: "MXN", dias: 10 }, // no cuenta
          { nombre: "B", saldo: 20_000, moneda: "MXN", dias: 35 },
          { nombre: "C", saldo: 30_000, moneda: "MXN", dias: 60 },
        ],
        top_acreedores: [],
      },
    });
    const kpis = calcularKPIsEjecutivos(snap, 0);
    expect(kpis.cartera_vencida_mxn).toBe(50_000);
    expect(kpis.cartera_vencida_count).toBe(2);
  });

  it("cero cuando todos los deudores tienen dias <= 30", () => {
    const snap = baseSnapshot({
      tesoreria: {
        cuentas: [],
        flujo: {
          por_cobrar_mxn: 0, por_cobrar_usd: 0,
          por_pagar_mxn: 0, por_pagar_usd: 0,
          flujo_neto_mxn: 0, flujo_neto_usd: 0,
        },
        top_deudores: [
          { nombre: "A", saldo: 10_000, moneda: "MXN", dias: 5 },
          { nombre: "B", saldo: 20_000, moneda: "MXN", dias: 30 },
        ],
        top_acreedores: [],
      },
    });
    const kpis = calcularKPIsEjecutivos(snap, 0);
    expect(kpis.cartera_vencida_mxn).toBe(0);
    expect(kpis.cartera_vencida_count).toBe(0);
  });
});
