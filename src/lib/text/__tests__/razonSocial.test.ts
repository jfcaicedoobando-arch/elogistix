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

  // VB-01 (patch-23): anti-mojibake. La capa de UI debe ser Unicode-safe para
  // nunca reproducir "BAJíO" (uppercase ASCII-only) ni "Ã" (doble decodificación).
  it("sube acentos y eñes a mayúsculas Unicode (anti-mojibake VB-01)", () => {
    expect(normalizarRazonSocial("Comercializadora del Bajío sa de cv")).toBe(
      "COMERCIALIZADORA DEL BAJÍO SA DE CV",
    );
    expect(normalizarRazonSocial("Electrónica Pacífico Niño Müller")).toBe(
      "ELECTRÓNICA PACÍFICO NIÑO MÜLLER",
    );
  });

  it("nunca deja minúsculas acentuadas ni marcadores de mojibake (VB-01)", () => {
    const resultado = normalizarRazonSocial("Piñataüra ñandú índice ópera");
    expect(resultado).not.toMatch(/[áéíóúñü]/);
    expect(resultado).not.toContain("Ã");
  });
});
