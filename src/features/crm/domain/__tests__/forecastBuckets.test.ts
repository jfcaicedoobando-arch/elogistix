import { describe, it, expect } from "vitest";
import { classifyEtapa, makeBucket, applyDelta } from "@/features/crm/domain/forecastBuckets";

describe("classifyEtapa", () => {
  it("identifica abierta/ganada", () => {
    expect(classifyEtapa("abierta")).toEqual({ abierta: true, ganada: false });
    expect(classifyEtapa("ganada")).toEqual({ abierta: false, ganada: true });
    expect(classifyEtapa("perdida")).toEqual({ abierta: false, ganada: false });
    expect(classifyEtapa(undefined)).toEqual({ abierta: false, ganada: false });
  });
});

describe("makeBucket", () => {
  it("crea bucket con totales en 0 y moneda", () => {
    expect(makeBucket("2026-06", "Junio 2026", "MXN")).toEqual({
      key: "2026-06", label: "Junio 2026", moneda: "MXN",
      pipeline: 0, ponderado: 0, ganado: 0, count: 0,
    });
  });
});

describe("applyDelta", () => {
  it("incrementa count siempre", () => {
    const b = makeBucket("k", "l", "MXN");
    applyDelta(b, { abierta: false, ganada: false, monto: 100, ponderado: 50 });
    expect(b.count).toBe(1);
    expect(b.pipeline).toBe(0);
    expect(b.ganado).toBe(0);
  });

  it("acumula pipeline/ponderado para abiertas", () => {
    const b = makeBucket("k", "l", "MXN");
    applyDelta(b, { abierta: true, ganada: false, monto: 100, ponderado: 60 });
    applyDelta(b, { abierta: true, ganada: false, monto: 200, ponderado: 120 });
    expect(b.pipeline).toBe(300);
    expect(b.ponderado).toBe(180);
    expect(b.count).toBe(2);
  });

  it("acumula ganado solo para ganadas (no afecta pipeline)", () => {
    const b = makeBucket("k", "l", "MXN");
    applyDelta(b, { abierta: false, ganada: true, monto: 500, ponderado: 500 });
    expect(b.ganado).toBe(500);
    expect(b.pipeline).toBe(0);
    expect(b.ponderado).toBe(0);
  });
});
