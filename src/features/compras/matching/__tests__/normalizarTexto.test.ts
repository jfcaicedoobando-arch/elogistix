import { describe, it, expect } from "vitest";
import { normalizarTexto, stripDiacritics } from "../normalizarTexto";

describe("normalizarTexto", () => {
  it("quita diacríticos y baja a minúsculas", () => {
    expect(stripDiacritics("Ñandú Águila")).toBe("Nandu Aguila");
    expect(normalizarTexto("Flete Marítimo SHÁNGHAI")).toBe("flete maritimo shanghai");
  });
  it("elimina stopwords del dominio", () => {
    expect(normalizarTexto("Servicio de flete marítimo")).toBe("flete maritimo");
    expect(normalizarTexto("Cargo por manejo en puerto")).toBe("manejo puerto");
  });
  it("colapsa espacios y quita puntuación", () => {
    expect(normalizarTexto("  Flete,   marítimo -  MZO ")).toBe("flete maritimo mzo");
  });
  it("acepta null/undefined/vacío", () => {
    expect(normalizarTexto(null)).toBe("");
    expect(normalizarTexto(undefined)).toBe("");
    expect(normalizarTexto("   ")).toBe("");
  });
});
