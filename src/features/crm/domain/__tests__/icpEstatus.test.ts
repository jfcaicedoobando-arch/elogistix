import { describe, expect, it } from "vitest";
import {
  etiquetaEstatusIcp,
  normalizarEstatusIcp,
  opcionesEstatusIcp,
  toLeadIcpForm,
  toLeadIcpPatch,
} from "@/features/crm/domain/leads/icp";

describe("estatus ICP canónico", () => {
  it("lee 'calificado' de la base y lo muestra como 'Calificado'", () => {
    const form = toLeadIcpForm({ estatus_icp: "calificado" });
    expect(form.estatus_icp).toBe("calificado");
    expect(etiquetaEstatusIcp(form.estatus_icp)).toBe("Calificado");
    expect(opcionesEstatusIcp(form.estatus_icp)).toEqual(
      expect.arrayContaining([{ value: "calificado", label: "Calificado" }]),
    );
  });

  it("guarda sin perder el valor persistido", () => {
    const form = toLeadIcpForm({ estatus_icp: "calificado" });
    expect(toLeadIcpPatch(form).estatus_icp).toBe("calificado");
  });

  it("normaliza vacíos, acentos y mayúsculas", () => {
    expect(normalizarEstatusIcp(null)).toBe("Sin calificar");
    expect(normalizarEstatusIcp("  ")).toBe("Sin calificar");
    expect(normalizarEstatusIcp("CALIFICADO")).toBe("calificado");
    expect(normalizarEstatusIcp("nutricion")).toBe("Nutrición");
  });

  it("conserva un valor histórico desconocido como opción visible", () => {
    expect(normalizarEstatusIcp("Reactivar 2027")).toBe("Reactivar 2027");
    expect(opcionesEstatusIcp("Reactivar 2027")).toEqual(
      expect.arrayContaining([{ value: "Reactivar 2027", label: "Reactivar 2027" }]),
    );
  });
});
