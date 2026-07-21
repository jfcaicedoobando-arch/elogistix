import { describe, it, expect } from "vitest";
import { tcValido, tcParaMoneda } from "../tcValido";

describe("tcValido", () => {
  it("acepta números finitos positivos", () => {
    expect(tcValido(17.25)).toBe(17.25);
    expect(tcValido("18.5")).toBe(18.5);
  });
  it("rechaza cero, negativos, NaN, null, undefined y strings basura", () => {
    for (const v of [0, -1, NaN, Infinity, null, undefined, "", "abc", {}]) {
      expect(tcValido(v)).toBeNull();
    }
  });
});

describe("tcParaMoneda", () => {
  it("MXN siempre 1 sin importar el TC", () => {
    expect(tcParaMoneda("MXN", null)).toBe(1);
    expect(tcParaMoneda("MXN", 0)).toBe(1);
  });
  it("USD/EUR delega en tcValido", () => {
    expect(tcParaMoneda("USD", 17.25)).toBe(17.25);
    expect(tcParaMoneda("EUR", null)).toBeNull();
    expect(tcParaMoneda("USD", 0)).toBeNull();
  });
});
