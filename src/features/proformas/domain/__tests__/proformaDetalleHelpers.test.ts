import { describe, it, expect } from "vitest";
import {
  vigenciaPlus30,
  resumirContenedores,
  resolverUbicacion,
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
