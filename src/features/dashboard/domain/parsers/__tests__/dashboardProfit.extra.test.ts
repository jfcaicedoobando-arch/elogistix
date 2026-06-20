import { describe, it, expect } from "vitest";
import {
  numOr0,
  numOrCompute,
  safeMargen,
  parseEmbarqueConProfitRaw,
} from "@/features/dashboard/domain/parsers/dashboardProfit";

describe("dashboardProfit | numOr0", () => {
  it("dashboardProfit.extra: retorna el número directamente", () => {
    expect(numOr0(42)).toBe(42);
  });

  it("retorna 0 para null", () => {
    expect(numOr0(null)).toBe(0);
  });

  it("retorna 0 para undefined", () => {
    expect(numOr0(undefined)).toBe(0);
  });

  it("retorna 0 para NaN", () => {
    expect(numOr0(NaN)).toBe(0);
  });

  it("retorna 0 para Infinity", () => {
    expect(numOr0(Infinity)).toBe(0);
  });

  it("retorna 0 para -Infinity", () => {
    expect(numOr0(-Infinity)).toBe(0);
  });

  it("parsea string numérico a number", () => {
    expect(numOr0("99.5")).toBe(99.5);
  });

  it("retorna 0 para string no numérico", () => {
    expect(numOr0("abc")).toBe(0);
  });

  it("retorna número negativo correctamente", () => {
    expect(numOr0(-55)).toBe(-55);
  });
});

describe("dashboardProfit | numOrCompute", () => {
  it("usa el valor definido en lugar del fallback", () => {
    expect(numOrCompute(10, () => 999)).toBe(10);
  });

  it("ejecuta fallback cuando el valor es undefined", () => {
    expect(numOrCompute(undefined, () => 55)).toBe(55);
  });

  it("ejecuta fallback cuando el valor es null", () => {
    expect(numOrCompute(null, () => 77)).toBe(77);
  });

  it("usa 0 directamente cuando el valor es 0 (no null/undefined)", () => {
    expect(numOrCompute(0, () => 999)).toBe(0);
  });
});

describe("dashboardProfit | safeMargen", () => {
  it("calcula el margen porcentual correctamente", () => {
    expect(safeMargen(25, 100)).toBeCloseTo(25, 5);
  });

  it("dashboardProfit.extra: retorna 0 cuando la venta es 0 (evita división por cero)", () => {
    expect(safeMargen(100, 0)).toBe(0);
  });

  it("retorna 0 cuando profit y venta son 0", () => {
    expect(safeMargen(0, 0)).toBe(0);
  });

  it("soporta margen negativo", () => {
    expect(safeMargen(-20, 100)).toBeCloseTo(-20, 5);
  });

  it("calcula correctamente el 50%", () => {
    expect(safeMargen(50, 100)).toBeCloseTo(50, 5);
  });
});

describe("dashboardProfit | parseEmbarqueConProfitRaw", () => {
  const base: Record<string, unknown> = {
    id: "emb-1",
    expediente: "EXP-001",
    cliente_nombre: "ACME",
    modo: "Maritimo",
    tipo: "FCL",
    estado: "Confirmado",
    estadoReal: "Confirmado",
    etd: null,
    eta: null,
    operador: "op@empresa.com",
    created_at: "2024-01-01",
    ventaUSD: 1000,
    costoUSD: 700,
    ventaMXN: 18000,
    costoMXN: 12000,
    tipoCambioUSD: 18,
    tipoCambioEUR: 20,
    ventaMxnFromUsd: 9000,
    costoMxnFromUsd: 6000,
    ventaMxnFromEur: 9000,
    costoMxnFromEur: 6000,
    ventaMxnNative: 0,
    costoMxnNative: 0,
  };

  it("calcula profit USD como ventaUSD - costoUSD cuando no viene en payload", () => {
    const result = parseEmbarqueConProfitRaw(base);
    expect(result.profit).toBeCloseTo(300, 5);
  });

  it("usa profit del payload si viene definido", () => {
    const result = parseEmbarqueConProfitRaw({ ...base, profit: 999 });
    expect(result.profit).toBe(999);
  });

  it("calcula margenMXN con fallback de safeMargen", () => {
    const result = parseEmbarqueConProfitRaw(base);
    expect(result.margenMXN).toBeCloseTo((6000 / 18000) * 100, 3);
  });

  it("retorna 0 para tipoCambioUSD con valor null", () => {
    const result = parseEmbarqueConProfitRaw({ ...base, tipoCambioUSD: null });
    expect(result.tipoCambioUSD).toBe(0);
  });

  it("incluye ventaMxnFromUsd correctamente", () => {
    const result = parseEmbarqueConProfitRaw(base);
    expect(result.ventaMxnFromUsd).toBe(9000);
  });

  it("retorna profitMXN calculado cuando no viene en payload", () => {
    const result = parseEmbarqueConProfitRaw(base);
    expect(result.profitMXN).toBeCloseTo(6000, 5);
  });

  it("usa profitMXN del payload si viene definido", () => {
    const result = parseEmbarqueConProfitRaw({ ...base, profitMXN: 1234 });
    expect(result.profitMXN).toBe(1234);
  });

  it("retorna 0 para campos MXN con valores null", () => {
    const result = parseEmbarqueConProfitRaw({ ...base, ventaMxnNative: null, costoMxnNative: null });
    expect(result.ventaMxnNative).toBe(0);
    expect(result.costoMxnNative).toBe(0);
  });

  it("calcula margen USD correctamente con fallback", () => {
    const result = parseEmbarqueConProfitRaw(base);
    expect(result.margen).toBeCloseTo((300 / 1000) * 100, 3);
  });
});
