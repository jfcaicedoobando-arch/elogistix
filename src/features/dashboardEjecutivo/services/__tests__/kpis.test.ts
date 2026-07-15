/**
 * v13.300.49 · calcularKPIsEjecutivos consume `cartera_vencida_total_mxn`
 * y `saldo_bancos_mxn` ya convertidos por el servicio de tesorería.
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
      cuentas: [],
      flujo: {
        por_cobrar_mxn: 0, por_cobrar_usd: 0,
        por_pagar_mxn: 0, por_pagar_usd: 0,
        flujo_neto_mxn: 0, flujo_neto_usd: 0,
        por_cobrar_total_mxn: 0, por_pagar_total_mxn: 0,
      },
      top_deudores: [],
      top_acreedores: [],
      saldo_bancos_mxn: 500_000,
      cartera_vencida_total_mxn: 0,
      cartera_vencida_count: 0,
      cxp_vencidas_count: 0,
      cxp_vencidas_total_mxn: 0,
    },
    presupuesto: {
      periodo: "2026-07",
      filas: [],
      total_presupuesto_mxn: 0,
      total_real_mxn: 0,
      variacion_neta_mxn: 0,
      categorias_en_exceso: 0,
      top_exceso: [],
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

describe("calcularKPIsEjecutivos · cartera vencida (v13.300.49)", () => {
  it("consume el total sin truncar del servicio de tesorería", () => {
    const snap = baseSnapshot({
      tesoreria: {
        cuentas: [],
        flujo: {
          por_cobrar_mxn: 0, por_cobrar_usd: 0,
          por_pagar_mxn: 0, por_pagar_usd: 0,
          flujo_neto_mxn: 0, flujo_neto_usd: 0,
          por_cobrar_total_mxn: 0, por_pagar_total_mxn: 0,
        },
        top_deudores: [],
        top_acreedores: [],
        saldo_bancos_mxn: 0,
        cartera_vencida_total_mxn: 250_000,
        cartera_vencida_count: 12,
        cxp_vencidas_count: 0,
        cxp_vencidas_total_mxn: 0,
      } as never,
    });
    const kpis = calcularKPIsEjecutivos(snap, 0);
    expect(kpis.cartera_vencida_mxn).toBe(250_000);
    expect(kpis.cartera_vencida_count).toBe(12);
  });

  it("DSO/DPO usan totales convertidos (MXN + USD*TC)", () => {
    const snap = baseSnapshot({
      tesoreria: {
        cuentas: [],
        flujo: {
          por_cobrar_mxn: 30_000, por_cobrar_usd: 0,
          por_pagar_mxn: 20_000, por_pagar_usd: 0,
          flujo_neto_mxn: 10_000, flujo_neto_usd: 0,
          por_cobrar_total_mxn: 60_000,
          por_pagar_total_mxn: 40_000,
        },
        top_deudores: [],
        top_acreedores: [],
        saldo_bancos_mxn: 0,
        cartera_vencida_total_mxn: 0,
        cartera_vencida_count: 0,
        cxp_vencidas_count: 0,
        cxp_vencidas_total_mxn: 0,
      } as never,
    });
    const kpis = calcularKPIsEjecutivos(snap, 0);
    // ingresos 100k, cxc30d 60k → DSO = 60/100*30 = 18
    expect(kpis.dso_dias).toBeCloseTo(18, 1);
    // costos 60k, cxp30d 40k → DPO = 40/60*30 = 20
    expect(kpis.dpo_dias).toBeCloseTo(20, 1);
  });
});
