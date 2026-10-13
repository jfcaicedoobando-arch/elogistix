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
    vencimientos: {
      fechaReferencia: "2026-07-01",
      cobranzaMayor30: { total_mxn: 0, count: 0, top: [], excluido_por_moneda: {} },
      cxpProximos7: { total_mxn: 0, count: 0, top: [], excluido_por_moneda: {} },
    },
    tesoreria: {
      cuentas: [{ id: "b1", nombre: "BBVA", saldo: 100_000, moneda: "MXN" }],
      flujo: {
        por_cobrar_mxn: 50_000, por_cobrar_usd: 0,
        por_pagar_mxn: 30_000, por_pagar_usd: 0,
        flujo_neto_mxn: 20_000, flujo_neto_usd: 0,
        por_cobrar_total_mxn: 50_000, por_pagar_total_mxn: 30_000,
      },
      top_deudores: [], top_acreedores: [],
      saldo_bancos_mxn: 100_000,
      cartera_vencida_total_mxn: 0, cartera_vencida_count: 0,
      cxp_vencidas_count: 0, cxp_vencidas_total_mxn: 0,
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
  it("DSO vivo no sustituye cartera histórica certificada", () => {
    const k = calcularKPIsEjecutivos(snap(), 0);
    expect(k.dso_dias).toBeNull();
  });

  it("DPO vivo no sustituye compras a crédito documentadas", () => {
    const k = calcularKPIsEjecutivos(snap(), 0);
    expect(k.dpo_dias).toBeNull();
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

  it("Utilidad positiva no habilita runway", () => {
    const k = calcularKPIsEjecutivos(snap(), 0);
    expect(k.runway_meses).toBeNull();
  });

  it("Pérdida contable no habilita runway", () => {
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
    expect(k.runway_meses).toBeNull();
  });

  it("Banco sin saldo no certifica caja disponible", () => {
    const k = calcularKPIsEjecutivos(
      snap({
        eerrPeriodo: {
          totalIngresos: { total: 50_000, mxn: 50_000, usd: 0 },
          totalCostos: { total: 100_000, mxn: 100_000, usd: 0 },
          utilidad: { total: -50_000, mxn: -50_000, usd: 0 },
          margen: -100, ingresos: [], costos: [],
        },
        tesoreria: {
          cuentas: [],
          flujo: {
            por_cobrar_mxn: 0, por_cobrar_usd: 0,
            por_pagar_mxn: 0, por_pagar_usd: 0,
            flujo_neto_mxn: 0, flujo_neto_usd: 0,
            por_cobrar_total_mxn: 0, por_pagar_total_mxn: 0,
          },
          top_deudores: [], top_acreedores: [],
          saldo_bancos_mxn: 0,
          cartera_vencida_total_mxn: 0, cartera_vencida_count: 0,
          cxp_vencidas_count: 0, cxp_vencidas_total_mxn: 0,
        },
      }),
      0,
    );
    expect(k.runway_meses).toBeNull();
  });
});

// No numeric fallback may remain reachable through the raw snapshot KPI fields.
describe('legacy ratios retired across current bank/profit combinations',()=>{
 it.each([-100,0,100].flatMap(saldo=>[-100,0,100].flatMap(resultado=>[false,true].map(parcial=>({saldo,resultado,parcial})))))('bank $saldo / profit $resultado / partial $parcial',({saldo,resultado,parcial})=>{
  const input=snap(); input.eerrPeriodo.totalCostos.total=100000-resultado;
  input.eerrPeriodo.utilidad.total=resultado;input.tesoreria.saldo_bancos_mxn=saldo;
  input.tesoreria.saldo_bancos_incompleto=parcial;
  expect(calcularKPIsEjecutivos(input,0)).toMatchObject({dso_dias:null,dpo_dias:null,runway_meses:null});
 });
});
