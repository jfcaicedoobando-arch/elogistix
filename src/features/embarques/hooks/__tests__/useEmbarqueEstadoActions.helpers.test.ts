import { describe, it, expect } from "vitest";
import { getSiguienteEstado } from "@/features/embarques/hooks/useEmbarqueEstadoActions.helpers";

/**
 * v13.302.10 — Regresión requestId c80465e4.
 * `getSiguienteEstado` debe respetar el happy path de la máquina de estados
 * de BD (mig. 20260718214722): Borrador → Cotización → Confirmado → En
 * Tránsito → En Aduana → Llegada → Arribo → Entregado → EIR → Cerrado.
 */
describe("getSiguienteEstado — happy path alineado con máquina de estados BD", () => {
  it("Borrador → Cotización", () => {
    expect(getSiguienteEstado("Borrador")).toBe("Cotización");
  });
  it("Cotización → Confirmado", () => {
    expect(getSiguienteEstado("Cotización")).toBe("Confirmado");
  });
  it("Confirmado → En Tránsito", () => {
    expect(getSiguienteEstado("Confirmado")).toBe("En Tránsito");
  });
  it("En Tránsito → En Aduana", () => {
    expect(getSiguienteEstado("En Tránsito")).toBe("En Aduana");
  });
  it("En Aduana → Llegada (regresión requestId c80465e4)", () => {
    expect(getSiguienteEstado("En Aduana")).toBe("Llegada");
  });
  it("Llegada → Arribo", () => {
    expect(getSiguienteEstado("Llegada")).toBe("Arribo");
  });
  it("Arribo → Entregado", () => {
    expect(getSiguienteEstado("Arribo")).toBe("Entregado");
  });
  it("Entregado → EIR", () => {
    expect(getSiguienteEstado("Entregado")).toBe("EIR");
  });
  it("EIR → Cerrado", () => {
    expect(getSiguienteEstado("EIR")).toBe("Cerrado");
  });
  it("Cerrado no tiene siguiente", () => {
    expect(getSiguienteEstado("Cerrado")).toBeNull();
  });
  it("estado desconocido retorna null", () => {
    expect(getSiguienteEstado("Inexistente")).toBeNull();
  });
});
