import { describe, it, expect } from "vitest";
import { calcularAlertas } from "../alertas";
import type { FlujoProyectado, SemanaFlujo } from "@/features/tesoreria/services";
import type { ResumenTesoreria } from "@/features/tesoreria/services";
import type { ResumenVsReal } from "@/features/presupuesto/services";

const semana = (over: Partial<SemanaFlujo> = {}): SemanaFlujo => ({
  semana_iso: "2026-W23",
  inicio: "2026-06-01",
  fin: "2026-06-07",
  entradas_mxn: 0,
  salidas_mxn: 0,
  flujo_neto_mxn: 0,
  saldo_proyectado_mxn: 0,
  detalle_entradas: [],
  detalle_salidas: [],
  ...over,
});

const flujo = (saldoFinal: number, semanas: SemanaFlujo[] = []): FlujoProyectado => ({
  saldo_inicial_mxn: 0,
  semanas,
  total_entradas_mxn: 0,
  total_salidas_mxn: 0,
  saldo_final_mxn: saldoFinal,
  alertas_negativas: semanas.filter((s) => s.saldo_proyectado_mxn < 0).length,
  saldo_incompleto: false,
  excluido_por_moneda: {},
});

const tesoreria = (over: Partial<ResumenTesoreria> = {}): ResumenTesoreria => ({
  cuentas: [],
  flujo: {
    por_cobrar_mxn: 0, por_cobrar_usd: 0, por_cobrar_eur: 0,
    por_pagar_mxn: 0, por_pagar_usd: 0, por_pagar_eur: 0,
    flujo_neto_mxn: 0, flujo_neto_usd: 0, flujo_neto_eur: 0,
    por_cobrar_total_mxn: 0, por_pagar_total_mxn: 0,
    flujo_incompleto: false,
  },
  top_deudores: [],
  top_acreedores: [],
  saldo_bancos_mxn: 0,
  saldo_bancos_incompleto: false,
  saldos_por_moneda: {},
  cartera_vencida_total_mxn: 0,
  cartera_vencida_count: 0,
  cxp_vencidas_count: 0,
  cxp_vencidas_total_mxn: 0,
  ...over,
});

const presupuesto = (filas: ResumenVsReal["filas"] = []): ResumenVsReal => {
  const excedidas = filas.filter((f) => f.presupuesto_mxn > 0 && f.cumplimiento_pct > 110);
  return {
    periodo: "2026-06",
    filas,
    total_presupuesto_mxn: filas.reduce((a, f) => a + f.presupuesto_mxn, 0),
    total_real_mxn: filas.reduce((a, f) => a + f.real_mxn, 0),
    variacion_neta_mxn: 0,
    categorias_en_exceso: excedidas.length,
    gastos_sin_tc_count: 0,
    real_truncado: false,
    top_exceso: [...excedidas].sort((a, b) => b.variacion_mxn - a.variacion_mxn).slice(0, 5),
  };
};

describe("calcularAlertas", () => {
  it("no genera alertas con datos limpios", () => {
    const r = calcularAlertas({
      flujo: flujo(100_000),
      tesoreria: tesoreria(),
      presupuesto: presupuesto(),
    });
    expect(r).toHaveLength(0);
  });

  it("detecta saldo proyectado negativo", () => {
    const r = calcularAlertas({
      flujo: flujo(-5000, [semana({ saldo_proyectado_mxn: -5000 })]),
      tesoreria: tesoreria(),
      presupuesto: presupuesto(),
    });
    expect(r.find((a) => a.severidad === "critica")).toBeDefined();
  });

  it("detecta cartera vencida sobre umbral", () => {
    const r = calcularAlertas({
      flujo: flujo(0),
      tesoreria: tesoreria({
        cartera_vencida_total_mxn: 80_000,
        cartera_vencida_count: 1,
        top_deudores: [{ nombre: "ACME", saldo: 80_000, moneda: "MXN", dias: 45 }],
      }),
      presupuesto: presupuesto(),
    });
    expect(r.some((a) => a.id === "cartera-vencida-alta")).toBe(true);
  });

  it("ignora cartera vencida bajo el umbral", () => {
    const r = calcularAlertas({
      flujo: flujo(0),
      tesoreria: tesoreria({
        cartera_vencida_total_mxn: 1_000,
        cartera_vencida_count: 1,
      }),
      presupuesto: presupuesto(),
    });
    expect(r.some((a) => a.id === "cartera-vencida-alta")).toBe(false);
  });

  it("detecta CxP vencidas", () => {
    const r = calcularAlertas({
      flujo: flujo(0),
      tesoreria: tesoreria({
        cxp_vencidas_count: 1,
        cxp_vencidas_total_mxn: 50_000,
        top_acreedores: [{ nombre: "Naviera X", saldo: 50_000, moneda: "USD", dias: 10 }],
      }),
      presupuesto: presupuesto(),
    });
    expect(r.some((a) => a.id === "cxp-vencidas")).toBe(true);
  });

  it("detecta categoría con cumplimiento >110%", () => {
    const r = calcularAlertas({
      flujo: flujo(0),
      tesoreria: tesoreria(),
      presupuesto: presupuesto([{
        categoria_id: "c1",
        categoria_nombre: "Operativo",
        presupuesto_mxn: 100,
        real_mxn: 150,
        variacion_mxn: 50,
        cumplimiento_pct: 150,
      }]),
    });
    expect(r.some((a) => a.id === "presupuesto-exceso-categoria")).toBe(true);
  });

  it("acepta umbral personalizado de cartera", () => {
    const r = calcularAlertas({
      flujo: flujo(0),
      tesoreria: tesoreria({
        cartera_vencida_total_mxn: 10_000,
        cartera_vencida_count: 1,
      }),
      presupuesto: presupuesto(),
      umbralCarteraVencida: 5_000,
    });
    expect(r.some((a) => a.id === "cartera-vencida-alta")).toBe(true);
  });
});
