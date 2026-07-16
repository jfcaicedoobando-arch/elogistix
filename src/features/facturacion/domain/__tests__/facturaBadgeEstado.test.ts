import { describe, it, expect } from "vitest";
import { deriveFacturaBadgeEstado } from "../facturaBadgeEstado";

describe("deriveFacturaBadgeEstado", () => {
  it("Cancelada + pending → En cancelación", () => {
    expect(deriveFacturaBadgeEstado("Cancelada", "pending")).toBe("En cancelación");
  });
  it("Cancelada + accepted → Cancelada", () => {
    expect(deriveFacturaBadgeEstado("Cancelada", "accepted")).toBe("Cancelada");
  });
  it("Cancelada sin acuse → Cancelada (retro-compat)", () => {
    expect(deriveFacturaBadgeEstado("Cancelada", null)).toBe("Cancelada");
    expect(deriveFacturaBadgeEstado("Cancelada", "")).toBe("Cancelada");
  });
  it("Sustituida → Sustituida", () => {
    expect(deriveFacturaBadgeEstado("Sustituida", null)).toBe("Sustituida");
  });
  it("Emitida no se modifica aunque venga acuse", () => {
    expect(deriveFacturaBadgeEstado("Emitida", "pending")).toBe("Emitida");
  });
  it("estado vacío devuelve vacío", () => {
    expect(deriveFacturaBadgeEstado(null, null)).toBe("");
  });
});
