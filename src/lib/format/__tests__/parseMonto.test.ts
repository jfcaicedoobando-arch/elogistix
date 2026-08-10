import { describe, it, expect } from "vitest";
import { limpiarSeparadoresMiles, parseMonto } from "../parseMonto";

describe("parseMonto (Ola 7 · B5)", () => {
  it("quita símbolos, espacios duros y separadores de miles", () => {
    expect(limpiarSeparadoresMiles("$ 1,200.50")).toBe("1200.50");
    expect(limpiarSeparadoresMiles("1\u00a0234,567")).toBe("1234567");
  });

  it("respeta la coma que NO es separador de miles", () => {
    expect(limpiarSeparadoresMiles("1,2")).toBe("1,2");
  });

  it("parsea montos con miles y decimales", () => {
    expect(parseMonto("1,200.50")).toBe(1200.5);
    expect(parseMonto("15,000")).toBe(15000);
  });

  it("degrada a fallback cuando el texto no es interpretable", () => {
    expect(parseMonto("")).toBe(0);
    expect(parseMonto("abc")).toBe(0);
    expect(parseMonto("1.2.3")).toBe(0);
    expect(parseMonto("", 5)).toBe(5);
  });
});
