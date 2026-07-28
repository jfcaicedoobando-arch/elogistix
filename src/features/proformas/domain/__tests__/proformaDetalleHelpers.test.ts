import { describe, it, expect } from "vitest";
import {
  vigenciaPlus30,
  resumirContenedores,
  resolverUbicacion,
  resolverDiasCredito,
  resumirEnvios,
} from "@/features/proformas/domain/proformaDetalleHelpers";

describe("proformaDetalleHelpers", () => {
  it("vigenciaPlus30 formatea fecha + 30 días", () => {
    expect(vigenciaPlus30("2026-07-01")).toMatch(/31\/07\/2026/);
  });

  it("vigenciaPlus30 tolera nulo / string vacío", () => {
    expect(vigenciaPlus30(null)).toBe("—");
    expect(vigenciaPlus30(undefined)).toBe("—");
    expect(vigenciaPlus30("")).toBe("—");
  });

  it("resumirContenedores: vacío", () => {
    expect(resumirContenedores([])).toBe("");
  });

  it("resumirContenedores ≤ 3 lista completa con tipos", () => {
    const r = resumirContenedores([
      { numero_contenedor: "ABCD1234567", tipo_contenedor: "40HC" },
      { numero_contenedor: "EFGH7654321", tipo_contenedor: null },
    ]);
    expect(r).toBe("ABCD1234567 · 40HC, EFGH7654321");
  });

  it("resumirContenedores > 3 agrupa por tipo y lista números", () => {
    const r = resumirContenedores([
      { numero_contenedor: "A1", tipo_contenedor: "40HC" },
      { numero_contenedor: "A2", tipo_contenedor: "40HC" },
      { numero_contenedor: "A3", tipo_contenedor: "20" },
      { numero_contenedor: "A4", tipo_contenedor: "20" },
    ]);
    expect(r).toContain("2 × 40HC + 2 × 20");
    expect(r).toContain("A1, A2, A3, A4");
  });

  it("resolverUbicacion respeta prioridad Puerto > Aeropuerto > Ciudad", () => {
    expect(resolverUbicacion("Manzanillo", "MEX", "Guadalajara")).toBe("Manzanillo");
    expect(resolverUbicacion(null, "MEX", "Guadalajara")).toBe("MEX");
    expect(resolverUbicacion(null, null, "Guadalajara")).toBe("Guadalajara");
    expect(resolverUbicacion(null, null, null)).toBe("—");
    expect(resolverUbicacion("  ", "  ", "CDMX")).toBe("CDMX");
  });
});

describe("resolverDiasCredito", () => {
  it("usa los días de la proforma cuando existen", () => {
    expect(resolverDiasCredito(15, 30)).toEqual({ dias: 15, heredado: false });
  });

  it("respeta el contado (0) de la proforma sin heredar", () => {
    expect(resolverDiasCredito(0, 30)).toEqual({ dias: 0, heredado: false });
  });

  it("hereda del cliente cuando la proforma no tiene días", () => {
    expect(resolverDiasCredito(null, 30)).toEqual({ dias: 30, heredado: true });
  });

  it("devuelve null cuando no hay dato en ninguno", () => {
    expect(resolverDiasCredito(undefined, null)).toEqual({ dias: null, heredado: false });
  });
});

describe("resumirEnvios", () => {
  it("devuelve vacío sin envíos", () => {
    expect(resumirEnvios([])).toEqual({ total: 0, ultimoAt: null });
    expect(resumirEnvios(null)).toEqual({ total: 0, ultimoAt: null });
  });

  it("cuenta envíos y toma el más reciente", () => {
    expect(
      resumirEnvios([
        { created_at: "2026-07-01T10:00:00Z" },
        { created_at: "2026-07-05T10:00:00Z" },
        { created_at: "2026-07-03T10:00:00Z" },
      ]),
    ).toEqual({ total: 3, ultimoAt: "2026-07-05T10:00:00Z" });
  });
});
