import { describe, it, expect } from "vitest";
import {
  esIncotermSinFleteVenta,
  esIncotermConSeguroIncluido,
} from "@/features/cotizacion/utils/incotermRules";

describe("esIncotermSinFleteVenta", () => {
  it.each([
    ["CIF", "Marítimo", true],
    ["CFR", "Marítimo", true],
    ["DAP", "Marítimo", true],
    ["DDP", "Marítimo", true],
    ["CIP", "Marítimo", true],
    ["FOB", "Marítimo", false],
    ["EXW", "Marítimo", false],
    ["FCA", "Marítimo", false],
    ["N/A", "Marítimo", false],
    ["CIF", "Aéreo", false],
    ["CIF", "Terrestre", false],
    ["", "Marítimo", false],
  ] as const)("incoterm=%s modo=%s → %s", (incoterm, modo, esperado) => {
    expect(esIncotermSinFleteVenta(incoterm, modo)).toBe(esperado);
  });

  it("retorna false cuando faltan datos", () => {
    expect(esIncotermSinFleteVenta(null, "Marítimo")).toBe(false);
    expect(esIncotermSinFleteVenta("CIF", null)).toBe(false);
    expect(esIncotermSinFleteVenta(undefined, undefined)).toBe(false);
  });
});

describe("esIncotermConSeguroIncluido", () => {
  it("CIF y CIP incluyen seguro", () => {
    expect(esIncotermConSeguroIncluido("CIF")).toBe(true);
    expect(esIncotermConSeguroIncluido("CIP")).toBe(true);
  });
  it("otros no", () => {
    expect(esIncotermConSeguroIncluido("FOB")).toBe(false);
    expect(esIncotermConSeguroIncluido("CFR")).toBe(false);
    expect(esIncotermConSeguroIncluido(null)).toBe(false);
  });
});
