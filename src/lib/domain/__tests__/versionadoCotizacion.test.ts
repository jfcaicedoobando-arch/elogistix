import { describe, it, expect } from "vitest";
import {
  calcularDeltaPct,
  calcularDelta,
  clasificarVarianza,
  construirFilaReconciliacion,
  construirResumen,
  UMBRALES_DEFAULT,
} from "@/lib/domain/versionadoCotizacion";

describe("calcularDeltaPct", () => {
  it("calcula incremento porcentual", () => {
    expect(calcularDeltaPct(100, 110)).toBe(10);
  });
  it("calcula decremento porcentual", () => {
    expect(calcularDeltaPct(100, 90)).toBe(-10);
  });
  it("base 0 con actual 0 da 0", () => {
    expect(calcularDeltaPct(0, 0)).toBe(0);
  });
  it("base 0 con actual >0 da 100", () => {
    expect(calcularDeltaPct(0, 50)).toBe(100);
  });
});

describe("clasificarVarianza", () => {
  it("dentro_rango cuando |Δ| < alerta_pct", () => {
    expect(clasificarVarianza(3)).toBe("dentro_rango");
    expect(clasificarVarianza(-4.9)).toBe("dentro_rango");
  });
  it("alerta cuando alerta_pct ≤ |Δ| < critica_pct", () => {
    expect(clasificarVarianza(5)).toBe("alerta");
    expect(clasificarVarianza(-14.9)).toBe("alerta");
  });
  it("critica cuando |Δ| ≥ critica_pct", () => {
    expect(clasificarVarianza(15)).toBe("critica");
    expect(clasificarVarianza(-20)).toBe("critica");
  });
  it("respeta umbrales custom", () => {
    expect(clasificarVarianza(8, { alerta_pct: 10, critica_pct: 20 })).toBe("dentro_rango");
    expect(clasificarVarianza(12, { alerta_pct: 10, critica_pct: 20 })).toBe("alerta");
  });
});

describe("construirFilaReconciliacion", () => {
  it("calcula los 3 deltas y clasifica por cot vs real", () => {
    const fila = construirFilaReconciliacion({
      concepto: "Flete",
      moneda: "USD",
      cotizado: 1000,
      refrescado: 1050,
      real: 1200,
    });
    expect(fila.delta_cot_vs_real).toEqual({ abs: 200, pct: 20 });
    expect(fila.delta_cot_vs_refr.pct).toBe(5);
    expect(fila.delta_refr_vs_real.abs).toBeCloseTo(150);
    expect(fila.clasificacion).toBe("critica");
  });
  it("clasifica dentro_rango cuando no hay desviación", () => {
    const fila = construirFilaReconciliacion({
      concepto: "THC", moneda: "USD", cotizado: 200, refrescado: 200, real: 202,
    });
    expect(fila.clasificacion).toBe("dentro_rango");
  });
});

describe("construirResumen", () => {
  it("suma totales y clasifica por delta agregado", () => {
    const filas = [
      construirFilaReconciliacion({ concepto: "A", moneda: "USD", cotizado: 100, refrescado: 100, real: 110 }),
      construirFilaReconciliacion({ concepto: "B", moneda: "USD", cotizado: 200, refrescado: 210, real: 220 }),
    ];
    // v13.778.0: los totales se normalizan a MXN; con T/C 1 el resultado es igual.
    const r = construirResumen(filas, undefined, { usd_mxn: 1 });
    expect(r.total_cotizado).toBe(300);
    expect(r.total_real).toBe(330);
    expect(r.moneda_total).toBe("MXN");
    expect(r.filas_sin_tipo_cambio).toBe(0);
    expect(r.delta_cot_vs_real.pct).toBe(10);
    expect(r.clasificacion).toBe("alerta");
  });
});

describe("construirResumen sin tipo de cambio", () => {
  it("excluye los renglones no convertibles y los reporta", () => {
    const filas = [
      construirFilaReconciliacion({ concepto: "A", moneda: "USD", cotizado: 100, refrescado: 100, real: 110 }),
      construirFilaReconciliacion({ concepto: "B", moneda: "MXN", cotizado: 200, refrescado: 200, real: 200 }),
    ];
    const r = construirResumen(filas);
    expect(r.total_cotizado).toBe(200);
    expect(r.filas_sin_tipo_cambio).toBe(1);
  });
});

describe("calcularDelta", () => {
  it("devuelve abs y pct juntos", () => {
    expect(calcularDelta(100, 150)).toEqual({ abs: 50, pct: 50 });
  });
});

describe("UMBRALES_DEFAULT", () => {
  it("son 5% y 15%", () => {
    expect(UMBRALES_DEFAULT).toEqual({ alerta_pct: 5, critica_pct: 15 });
  });
});
