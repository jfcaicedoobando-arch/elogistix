import { describe, it, expect } from "vitest";
import {
  esNumeroContenedorValido,
  normalizarNumeroContenedor,
} from "@/features/embarques/domain/contenedorIso6346";

describe("contenedorIso6346", () => {
  it("acepta vacío / null / undefined", () => {
    expect(esNumeroContenedorValido("")).toBe(true);
    expect(esNumeroContenedorValido("   ")).toBe(true);
    expect(esNumeroContenedorValido(null)).toBe(true);
    expect(esNumeroContenedorValido(undefined)).toBe(true);
  });

  it("acepta patrón ISO 6346 correcto", () => {
    expect(esNumeroContenedorValido("MSCU1234567")).toBe(true);
    expect(esNumeroContenedorValido("MSKU7654321")).toBe(true);
  });

  it("rechaza formatos inválidos", () => {
    expect(esNumeroContenedorValido("1")).toBe(false);
    expect(esNumeroContenedorValido("mscu1234567")).toBe(false);
    expect(esNumeroContenedorValido("MSCU12345")).toBe(false);
    expect(esNumeroContenedorValido("MSCU12345678")).toBe(false);
    expect(esNumeroContenedorValido("MSC1234567X")).toBe(false);
  });

  it("normaliza a mayúsculas y sin espacios", () => {
    expect(normalizarNumeroContenedor("  mscu 123 4567 ")).toBe("MSCU1234567");
    expect(normalizarNumeroContenedor("mscu1234567")).toBe("MSCU1234567");
  });
});
