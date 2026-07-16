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
  it("Emitida sin cancellation_status no se modifica aunque venga acuseStatus", () => {
    expect(deriveFacturaBadgeEstado("Emitida", "pending")).toBe("Emitida");
  });
  it("Emitida + cancellation_status pending → En cancelación", () => {
    expect(deriveFacturaBadgeEstado("Emitida", null, "pending")).toBe("En cancelación");
  });
  it("Emitida + cancellation_status verifying → En cancelación", () => {
    expect(deriveFacturaBadgeEstado("Emitida", null, "verifying")).toBe("En cancelación");
  });
  it("Emitida + cancellation_status vacío → Emitida", () => {
    expect(deriveFacturaBadgeEstado("Emitida", null, null)).toBe("Emitida");
    expect(deriveFacturaBadgeEstado("Emitida", null, "")).toBe("Emitida");
  });
  it("estado vacío devuelve vacío", () => {
    expect(deriveFacturaBadgeEstado(null, null)).toBe("");
  });
});
