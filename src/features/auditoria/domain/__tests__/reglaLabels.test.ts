import { describe, it, expect } from "vitest";
import { REGLA_SHORT_LABELS, reglaShortLabel } from "../reglaLabels";
import { REGLA_INFO } from "@/features/auditoria/constants/auditoriaConfig";
import type { ReglaAuditoria } from "@/features/auditoria/types";

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
    expect(reglaShortLabel("margen_negativo")).toBe("Margen estimado negativo");
    expect(reglaShortLabel("proforma_vencida")).toBe("Proforma vencida");
  });

  it("todas las etiquetas son strings no vacíos", () => {
    for (const v of Object.values(REGLA_SHORT_LABELS)) {
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(0);
    }
  });

  // L-4 (auditoría 13.21.25): garantiza que `REGLA_INFO.shortLabel` (config visual
  // duplicada en `auditoriaConfig.ts`) coincida con `reglaShortLabel()` para
  // todas las reglas — si alguien renombra una sola, este test rompe en CI.
  it("REGLA_INFO.shortLabel es consistente con reglaShortLabel() para toda regla", () => {
    const reglas = Object.keys(REGLA_SHORT_LABELS) as ReglaAuditoria[];
    for (const r of reglas) {
      expect(REGLA_INFO[r].shortLabel).toBe(reglaShortLabel(r));
    }
  });
});
