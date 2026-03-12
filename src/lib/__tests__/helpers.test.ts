import { describe, it, expect } from "vitest";
// @ts-ignore - suppress date-fns ESM resolution warnings in test
import { formatDate, getEstadoColor, getModoIcon } from "@/lib/helpers";

describe("formatDate", () => {
  it("devuelve '-' para cadena vacía", () => {
    expect(formatDate("")).toBe("-");
  });
  it("formatea fecha ISO correctamente", () => {
    expect(formatDate("2026-03-01")).toBe("01/03/2026");
  });
  it("parsea cadena parcial (YYYY-MM) como primer día del mes", () => {
    expect(formatDate("2026-03")).toBe("01/03/2026");
  });
});

describe("getEstadoColor", () => {
  it("retorna clase correcta para cada estado conocido", () => {
    expect(getEstadoColor("Confirmado")).toContain("text-info");
    expect(getEstadoColor("En Tránsito")).toContain("text-warning");
    expect(getEstadoColor("Arribo")).toContain("text-cyan-600");
    expect(getEstadoColor("En Aduana")).toContain("text-violet-600");
    expect(getEstadoColor("Entregado")).toContain("text-emerald-600");
    expect(getEstadoColor("EIR")).toContain("text-orange-600");
    expect(getEstadoColor("Cerrado")).toContain("text-muted-foreground");
    expect(getEstadoColor("Pagada")).toContain("text-success");
    expect(getEstadoColor("Vencida")).toContain("text-destructive");
  });
  it("retorna default para estado desconocido", () => {
    expect(getEstadoColor("Inventado")).toBe("bg-muted text-muted-foreground");
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
