/**
 * M11 — Parser fiscal canónico de conceptos.
 */
import { describe, it, expect } from "vitest";
import {
  parseNumeroFiscal,
  parseImporteFiscal,
  parseCantidadFiscal,
  normalizarDescripcionFiscal,
  normalizarClaveSat,
} from "../facturaConceptos";

describe("parseNumeroFiscal", () => {
  it("acepta números finitos y rechaza NaN/Infinity", () => {
    expect(parseNumeroFiscal(12.5)).toBe(12.5);
    expect(parseNumeroFiscal(Number.NaN)).toBeNull();
    expect(parseNumeroFiscal(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("interpreta strings con separador de miles, moneda y espacios", () => {
    expect(parseNumeroFiscal("1,200.50")).toBe(1200.5);
    expect(parseNumeroFiscal("$ 3,000")).toBe(3000);
    expect(parseNumeroFiscal("\u00a01 000")).toBe(1000);
  });

  it("devuelve null para texto no numérico o vacío", () => {
    expect(parseNumeroFiscal("")).toBeNull();
    expect(parseNumeroFiscal("N/A")).toBeNull();
    expect(parseNumeroFiscal(null)).toBeNull();
  });
});

describe("parseImporteFiscal", () => {
  it("redondea a 2 decimales y usa fallback cuando no es parseable", () => {
    expect(parseImporteFiscal("1,200.505")).toBe(1200.51);
    expect(parseImporteFiscal("basura")).toBe(0);
    expect(parseImporteFiscal(undefined, 7)).toBe(7);
  });
});

describe("parseCantidadFiscal", () => {
  it("conserva cantidades decimales en lugar de redondear a entero", () => {
    expect(parseCantidadFiscal("0.5")).toBe(0.5);
    expect(parseCantidadFiscal(2.25)).toBe(2.25);
  });

  it("usa el fallback para cantidades no positivas o inválidas", () => {
    expect(parseCantidadFiscal(0)).toBe(1);
    expect(parseCantidadFiscal(-3)).toBe(1);
    expect(parseCantidadFiscal("x", 2)).toBe(2);
  });
});

describe("normalizadores de texto fiscal", () => {
  it("colapsa espacios y devuelve null si queda vacío", () => {
    expect(normalizarDescripcionFiscal("  Flete   marítimo ")).toBe("Flete marítimo");
    expect(normalizarDescripcionFiscal("   ")).toBeNull();
    expect(normalizarDescripcionFiscal(42)).toBeNull();
  });

  it("normaliza claves SAT a mayúsculas", () => {
    expect(normalizarClaveSat(" 78101800 ")).toBe("78101800");
    expect(normalizarClaveSat("e48")).toBe("E48");
    expect(normalizarClaveSat("")).toBeNull();
  });
});
