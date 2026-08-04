import { describe, it, expect } from "vitest";
import { normalizarRazonSocial } from "../razonSocial";

describe("normalizarRazonSocial", () => {
  it("convierte a mayúsculas conservando acentos", () => {
    expect(normalizarRazonSocial("Aceros del Pacífico SA")).toBe("ACEROS DEL PACÍFICO SA");
  });

  it("colapsa espacios y recorta extremos", () => {
    expect(normalizarRazonSocial("  hk   ls  limited ")).toBe("HK LS LIMITED");
  });

  it("tolera vacíos y nulos", () => {
    expect(normalizarRazonSocial("")).toBe("");
    expect(normalizarRazonSocial(null)).toBe("");
    expect(normalizarRazonSocial(undefined)).toBe("");
  });
});
