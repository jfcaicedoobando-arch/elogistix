import { describe, it, expect } from "vitest";
import { getEstadoVisual, ESTADO_CONFIG } from "@/lib/ui/estadoConfig";
import { kpiIconChipClasses } from "@/lib/ui/kpiTones";

describe("getEstadoVisual", () => {
  it("retorna config específica para estados conocidos", () => {
    const v = getEstadoVisual("Confirmado");
    expect(v.bar).toBe("bg-info");
    expect(v.badge).toContain("text-info");
  });

  it("aplica fallback default para estados desconocidos", () => {
    const v = getEstadoVisual("NoExiste");
    expect(v.badge).toContain("muted");
    expect(v.bar).toBe("bg-muted-foreground");
  });

  it("cubre estados de cotización", () => {
    expect(getEstadoVisual("Aceptada").badge).toContain("warning");
    expect(getEstadoVisual("Rechazada").badge).toContain("destructive");
  });

  it("ESTADO_CONFIG incluye estados clave de embarque", () => {
    expect(ESTADO_CONFIG).toHaveProperty("Confirmado");
    expect(ESTADO_CONFIG).toHaveProperty("En Tránsito");
    expect(ESTADO_CONFIG).toHaveProperty("Arribo");
  });
});

describe("kpiIconChipClasses", () => {
  it("genera bg-*-soft y text-* según tono", () => {
    expect(kpiIconChipClasses("info")).toBe("bg-kpi-info-soft text-kpi-info");
    expect(kpiIconChipClasses("danger")).toBe("bg-kpi-danger-soft text-kpi-danger");
    expect(kpiIconChipClasses("success")).toBe("bg-kpi-success-soft text-kpi-success");
  });
});
