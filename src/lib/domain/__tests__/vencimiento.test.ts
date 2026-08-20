import { describe, it, expect } from "vitest";
import {
  DIAS_POR_VENCER_CXC,
  esAccionable,
  esCxcVencida,
  esVencidoPorDias,
  esVencidoPorDiasParaVencer,
  estaPorVencer,
} from "@/lib/domain/vencimiento";
import { resumirAgingMxn, CUBETAS_VENCIDAS } from "@/lib/domain/carteraAging";

describe("canon de vencimiento", () => {
  it("esVencidoPorDias sólo cuenta días positivos", () => {
    expect(esVencidoPorDias(1)).toBe(true);
    expect(esVencidoPorDias(0)).toBe(false);
    expect(esVencidoPorDias(-3)).toBe(false);
    expect(esVencidoPorDias(null)).toBe(false);
  });

  it("normaliza la convención invertida de CxP (dias_para_vencer)", () => {
    expect(esVencidoPorDiasParaVencer(-1)).toBe(true);
    expect(esVencidoPorDiasParaVencer(0)).toBe(false);
    expect(esVencidoPorDiasParaVencer(5)).toBe(false);
  });

  it("la ventana por vencer incluye 'vence hoy' y respeta el umbral único", () => {
    expect(estaPorVencer(0)).toBe(true);
    expect(estaPorVencer(-DIAS_POR_VENCER_CXC)).toBe(true);
    expect(estaPorVencer(-DIAS_POR_VENCER_CXC - 1)).toBe(false);
    expect(estaPorVencer(1)).toBe(false);
  });

  it("accionable = vencida o por vencer", () => {
    expect(esAccionable(3)).toBe(true);
    expect(esAccionable(-2)).toBe(true);
    expect(esAccionable(-30)).toBe(false);
  });

  it("esCxcVencida usa el estatus derivado y cae a los días crudos", () => {
    expect(esCxcVencida({ saldo: 100, estatus_cobranza: "Vencida" })).toBe(true);
    expect(esCxcVencida({ saldo: 0, estatus_cobranza: "Vencida" })).toBe(false);
    expect(esCxcVencida({ saldo: 100, estatus_cobranza: "Vigente", dias_vencido: 9 })).toBe(false);
    expect(esCxcVencida({ saldo: 100, dias_vencido: 9 })).toBe(true);
    expect(esCxcVencida({ saldo: 100, dias_vencido: -9 })).toBe(false);
  });
});

describe("resumirAgingMxn", () => {
  it("usa las cubetas oficiales y convierte a MXN", () => {
    const r = resumirAgingMxn([
      { saldo: 100, moneda: "MXN", dias_vencido: -5 },
      { saldo: 200, moneda: "MXN", dias_vencido: 10 },
      { saldo: 10, moneda: "USD", tipo_cambio: 20, dias_vencido: 45 },
      { saldo: 300, moneda: "MXN", dias_vencido: 120 },
    ]);
    expect(r.buckets.vigente).toBe(100);
    expect(r.buckets.d_1_30).toBe(200);
    expect(r.buckets.d_31_60).toBe(200);
    expect(r.buckets.mas_90).toBe(300);
    expect(r.totalVencido).toBe(700);
    expect(CUBETAS_VENCIDAS).not.toContain("vigente");
  });

  it("excluye y cuenta los saldos sin tipo de cambio confiable", () => {
    const r = resumirAgingMxn([
      { saldo: 50, moneda: "EUR", tipo_cambio: null, dias_vencido: 20 },
      { saldo: 0, moneda: "MXN", dias_vencido: 20 },
    ]);
    expect(r.sinTipoCambio).toBe(1);
    expect(r.totalVencido).toBe(0);
  });
});
