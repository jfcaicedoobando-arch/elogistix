import { describe, it, expect } from "vitest";
import { calcularScore, calcularRegresion, RIESGO_UMBRAL_MXN } from "../ejecutivoScore";

describe("calcularScore", () => {
  it("retorna 100 excelente cuando no hay pendientes", () => {
    expect(calcularScore(0, 0)).toEqual({ score: 100, scoreEstado: "excelente" });
  });

  it("usa solo higiene cuando riesgoMxn = 0", () => {
    const { score } = calcularScore(10, 5, 0);
    expect(score).toBe(Math.round(100 - 20));
  });

  it("combina 40% higiene + 60% económico cuando hay riesgo", () => {
    const { score } = calcularScore(0, 3, RIESGO_UMBRAL_MXN / 2);
    // higiene=100, economico=50 → 0.4*100 + 0.6*50 = 70
    expect(score).toBe(70);
  });

  it("clampa el score a 0 cuando el riesgo supera el umbral", () => {
    const { score, scoreEstado } = calcularScore(100, 10, RIESGO_UMBRAL_MXN * 5);
    expect(score).toBe(0);
    expect(scoreEstado).toBe("malo");
  });

  it("asigna estados según los thresholds", () => {
    expect(calcularScore(0, 1, 0).scoreEstado).toBe("excelente");
    expect(calcularScore(10, 5, 0).scoreEstado).toMatch(/bueno|regular|malo|excelente/);
  });
});

describe("calcularRegresion", () => {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return iso(d);
  };

  it("devuelve null sin snapshots", () => {
    expect(calcularRegresion(80, [])).toBeNull();
  });

  it("encuentra el snapshot más cercano a 7 días", () => {
    const snapshots = [
      { fecha: daysAgo(7), score: 70 },
      { fecha: daysAgo(30), score: 60 },
    ];
    const r = calcularRegresion(80, snapshots);
    expect(r).not.toBeNull();
    expect(r!.scoreAnterior).toBe(70);
    expect(r!.diferencia).toBe(10);
  });

  it("retorna null si el snapshot está fuera de ±3 días", () => {
    const snapshots = [{ fecha: daysAgo(30), score: 50 }];
    expect(calcularRegresion(80, snapshots)).toBeNull();
  });

  it("respeta el parámetro diasAtras", () => {
    const snapshots = [{ fecha: daysAgo(30), score: 50 }];
    const r = calcularRegresion(80, snapshots, 30);
    expect(r?.scoreAnterior).toBe(50);
  });
});
