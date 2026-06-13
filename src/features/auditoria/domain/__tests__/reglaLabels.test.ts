import { describe, it, expect } from "vitest";
import { REGLA_SHORT_LABELS, reglaShortLabel } from "../reglaLabels";

describe("reglaLabels", () => {
  it("define etiquetas para todas las reglas conocidas", () => {
    const reglas = Object.keys(REGLA_SHORT_LABELS);
    expect(reglas).toContain("docs_faltantes");
    expect(reglas).toContain("margen_negativo");
    expect(reglas).toContain("embarque_huerfano");
    expect(reglas.length).toBeGreaterThanOrEqual(10);
  });

  it("reglaShortLabel devuelve la etiqueta correcta", () => {
    expect(reglaShortLabel("docs_faltantes")).toBe("Documentos faltantes");
    expect(reglaShortLabel("margen_negativo")).toBe("Margen negativo");
    expect(reglaShortLabel("proforma_vencida")).toBe("Proforma vencida");
  });

  it("todas las etiquetas son strings no vacíos", () => {
    for (const v of Object.values(REGLA_SHORT_LABELS)) {
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(0);
    }
  });
});
