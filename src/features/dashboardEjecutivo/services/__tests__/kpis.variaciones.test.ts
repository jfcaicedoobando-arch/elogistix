/**
 * Tests Fase I para `calcularKPIsEjecutivos`: `utilidad_delta_pct` y
 * `margen_delta_puntos` cuando se proporciona `eerrPrevio`.
 */
import { describe, it, expect } from "vitest";
import { calcularKPIsEjecutivos } from "../alertas";
import type { SnapshotEjecutivo } from "../types";

function makeEerr(ingresos: number, costos: number): SnapshotEjecutivo["eerrPeriodo"] {
  const total = ingresos - costos;
  const zeros = { "Marítimo": 0, "Aéreo": 0, "Terrestre": 0 };
  return {
    totalIngresos: { total: ingresos, porModo: { ...zeros } },
    totalCostos: { total: costos, porModo: { ...zeros } },
    utilidad: { total, porModo: { ...zeros } },
    margen: { total: ingresos > 0 ? (total / ingresos) * 100 : 0, porModo: { ...zeros } },
    ingresos: [],
    costos: [],
  } as unknown as SnapshotEjecutivo["eerrPeriodo"];
}

function baseSnap(eerrPeriodo: ReturnType<typeof makeEerr>) {
  return {
    periodo: "2026-07",
    eerrPeriodo,
    eerr12m: [],
    tesoreria: {
      cuentas: [],
      flujo: {
        por_cobrar_mxn: 0, por_cobrar_usd: 0,
        por_pagar_mxn: 0, por_pagar_usd: 0,
        flujo_neto_mxn: 0, flujo_neto_usd: 0,
      },
      top_deudores: [],
      top_acreedores: [],
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
  } as unknown as Omit<SnapshotEjecutivo, "kpis" | "alertas" | "topDeudores" | "topAcreedores" | "generadoEn">;
}

describe("calcularKPIsEjecutivos · variaciones vs mes anterior (Fase I)", () => {
  it("utilidad crece 25% y margen sube 5pp", () => {
    const actual = makeEerr(100_000, 60_000); // util 40k, margen 40%
    const prev = makeEerr(100_000, 68_000);   // util 32k, margen 32%
    const k = calcularKPIsEjecutivos(baseSnap(actual), prev.totalIngresos.total, prev);
    expect(k.utilidad_delta_pct).toBeCloseTo(25, 5);
    expect(k.margen_delta_puntos).toBeCloseTo(8, 5);
  });

  it("utilidad cae → delta negativo", () => {
    const actual = makeEerr(100_000, 90_000); // util 10k, margen 10%
    const prev = makeEerr(100_000, 70_000);   // util 30k, margen 30%
    const k = calcularKPIsEjecutivos(baseSnap(actual), prev.totalIngresos.total, prev);
    expect(k.utilidad_delta_pct).toBeCloseTo(-66.6666, 3);
    expect(k.margen_delta_puntos).toBeCloseTo(-20, 5);
  });

  it("utilidad previa 0 → utilidad_delta_pct es null (evita Infinity)", () => {
    const actual = makeEerr(100_000, 60_000);
    const prev = makeEerr(50_000, 50_000); // util = 0
    const k = calcularKPIsEjecutivos(baseSnap(actual), prev.totalIngresos.total, prev);
    expect(k.utilidad_delta_pct).toBeNull();
    expect(k.margen_delta_puntos).toBeCloseTo(40, 5); // ingresos prev > 0 sigue funcionando
  });

  it("utilidad previa negativa → utilidad_delta_pct es null", () => {
    const actual = makeEerr(100_000, 60_000);
    const prev = makeEerr(50_000, 80_000); // util = -30k
    const k = calcularKPIsEjecutivos(baseSnap(actual), prev.totalIngresos.total, prev);
    expect(k.utilidad_delta_pct).toBeNull();
  });

  it("ingresos previos 0 → ingresos_delta_pct y margen_delta_puntos son null (Fase I fix)", () => {
    const actual = makeEerr(100_000, 60_000);
    const prev = makeEerr(0, 0);
    const k = calcularKPIsEjecutivos(baseSnap(actual), 0, prev);
    expect(k.ingresos_delta_pct).toBeNull();
    expect(k.margen_delta_puntos).toBeNull();
    expect(k.utilidad_delta_pct).toBeNull();
  });

  it("sin eerrPrevio → utilidad/margen null, ingresos delta calculado normal", () => {
    const actual = makeEerr(100_000, 60_000);
    const k = calcularKPIsEjecutivos(baseSnap(actual), 80_000);
    expect(k.utilidad_delta_pct).toBeNull();
    expect(k.margen_delta_puntos).toBeNull();
    expect(k.ingresos_delta_pct).toBeCloseTo(25, 5);
  });
});
