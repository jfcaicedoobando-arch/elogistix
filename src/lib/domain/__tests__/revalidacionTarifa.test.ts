import { describe, it, expect } from "vitest";
import {
  calcularDeltaPct,
  clasificarSeveridad,
  resumirDelta,
  RevalidacionRequeridaError,
  type CambioTarifa,
  type ResultadoRevalidacion,
} from "@/lib/domain/revalidacionTarifa";

const cambio = (over: Partial<CambioTarifa> = {}): CambioTarifa => ({
  concepto: "Flete",
  moneda: "USD",
  monto_anterior: 100,
  monto_actual: 100,
  delta_abs: 0,
  delta_pct: 0,
  ...over,
});

describe("calcularDeltaPct", () => {
  it("devuelve 0 cuando ambos son 0", () => {
    expect(calcularDeltaPct(0, 0)).toBe(0);
  });
  it("devuelve 100 cuando anterior es 0 y actual no", () => {
    expect(calcularDeltaPct(0, 50)).toBe(100);
  });
  it("calcula porcentaje absoluto redondeado a 2 decimales", () => {
    expect(calcularDeltaPct(100, 110)).toBe(10);
    expect(calcularDeltaPct(100, 90)).toBe(10);
    expect(calcularDeltaPct(33, 50)).toBe(51.52);
  });
  it("trata signos negativos como magnitud", () => {
    expect(calcularDeltaPct(-100, -110)).toBe(10);
  });
});

describe("clasificarSeveridad", () => {
  it("bloqueante si tarifa vencida y política bloquea", () => {
    expect(clasificarSeveridad([], 5, false, true)).toBe("bloqueante");
  });
  it("sin_cambios si tarifa vigente y sin cambios", () => {
    expect(clasificarSeveridad([], 5, true, true)).toBe("sin_cambios");
  });
  it("informativa cuando delta máximo <= umbral", () => {
    const cambios = [cambio({ delta_pct: 3 }), cambio({ delta_pct: 5 })];
    expect(clasificarSeveridad(cambios, 5, true, true)).toBe("informativa");
  });
  it("bloqueante cuando delta máximo > umbral", () => {
    const cambios = [cambio({ delta_pct: 3 }), cambio({ delta_pct: 8 })];
    expect(clasificarSeveridad(cambios, 5, true, true)).toBe("bloqueante");
  });
  it("trata delta_pct=null (recargo eliminado) como 100% — bloqueante", () => {
    const cambios = [cambio({ delta_pct: null, motivo: "eliminado" })];
    expect(clasificarSeveridad(cambios, 5, true, true)).toBe("bloqueante");
  });
  it("informativa si tarifa vencida pero política NO bloquea", () => {
    expect(clasificarSeveridad([cambio({ delta_pct: 2 })], 5, false, false)).toBe("informativa");
  });
});

describe("resumirDelta", () => {
  it("agrega por moneda", () => {
    const cambios: CambioTarifa[] = [
      cambio({ moneda: "USD", delta_abs: 10 }),
      cambio({ moneda: "USD", delta_abs: -3 }),
      cambio({ moneda: "MXN", delta_abs: 50 }),
    ];
    expect(resumirDelta(cambios)).toEqual({ total_usd: 7, total_mxn: 50, conceptos: 3 });
  });
  it("trata delta_abs null como 0", () => {
    expect(resumirDelta([cambio({ delta_abs: null })])).toEqual({
      total_usd: 0,
      total_mxn: 0,
      conceptos: 1,
    });
  });
});

describe("RevalidacionRequeridaError", () => {
  it("conserva el resultado para que la UI pueda renderizar el modal", () => {
    const res: ResultadoRevalidacion = {
      tarifa_vigente: false,
      agente_sin_cupo: false,
      severidad: "bloqueante",
      cambios: [],
      umbral_pct: 5,
      max_delta_pct: 0,
    };
    const err = new RevalidacionRequeridaError(res);
    expect(err.resultado).toBe(res);
    expect(err.name).toBe("RevalidacionRequeridaError");
    expect(err.message).toMatch(/bloqueante/);
  });
});
