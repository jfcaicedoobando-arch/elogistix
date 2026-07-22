import { describe, it, expect } from "vitest";
import { getEstadoColor, getModoIcon } from "@/lib/ui/uiMappings";

// Nota: tests de formatDate viven en src/lib/formatters/__tests__/formatters.test.ts
// (eliminados de aquí en v11.39.0 — eran duplicado textual).



describe("getEstadoColor", () => {
  it("retorna clase correcta para cada estado conocido", () => {
    expect(getEstadoColor("Confirmado")).toContain("text-info");
    expect(getEstadoColor("En Tránsito")).toContain("text-warning");
    expect(getEstadoColor("Arribo")).toContain("text-state-arribo");
    expect(getEstadoColor("En Aduana")).toContain("text-state-aduana");
    expect(getEstadoColor("Entregado")).toContain("text-success");
    expect(getEstadoColor("EIR")).toContain("text-state-eir");
    expect(getEstadoColor("Cerrado")).toContain("text-muted-foreground");
    // v13.308.4: Pagada = terminal neutro (design decision — libera el verde para Aprobada/Validado/Completo).
    expect(getEstadoColor("Pagada")).toContain("text-muted-foreground");
    expect(getEstadoColor("Vencida")).toContain("text-destructive");
  });
  it("retorna default para estado desconocido", () => {
    expect(getEstadoColor("Inventado")).toBe("bg-muted text-muted-foreground border border-border");
  });
});

describe("getModoIcon", () => {
  it("retorna emoji correcto por modo", () => {
    expect(getModoIcon("Marítimo")).toBe("🚢");
    expect(getModoIcon("Aéreo")).toBe("✈️");
    expect(getModoIcon("Terrestre")).toBe("🚛");
    expect(getModoIcon("Multimodal")).toBe("🔄");
  });
  it("retorna 📦 para modo desconocido", () => {
    expect(getModoIcon("Otro")).toBe("📦");
  });
});
