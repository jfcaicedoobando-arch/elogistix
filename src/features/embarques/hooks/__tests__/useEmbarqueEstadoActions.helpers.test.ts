import { describe, it, expect } from "vitest";
import { getSiguienteEstado } from "@/features/embarques/hooks/useEmbarqueEstadoActions.helpers";

/**
 * v13.303.21 — `getSiguienteEstado` debe respetar el happy path actual de la
 * máquina de estados de BD: Borrador → Confirmado → En Tránsito → En Aduana →
 * Llegada → Arribo → Entregado → EIR → Cerrado. (Estado intermedio
 * `Cotización` / Propuesta eliminado del workflow.)
 */
describe("getSiguienteEstado — happy path alineado con máquina de estados BD", () => {
  it("Borrador → Confirmado (v13.303.21: sin escala en Propuesta)", () => {
    expect(getSiguienteEstado("Borrador")).toBe("Confirmado");
  });
  it("Cotización → Confirmado (rescate de embarques legacy)", () => {
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
  // v13.302.11 — `En Proceso` es un estado lateral del grafo BD. Si
  // getSiguienteEstado retornara null el botón "Avanzar estado" desaparecería
  // dejando al operador atorado.
  it("En Proceso → En Aduana (estado lateral del grafo BD)", () => {
    expect(getSiguienteEstado("En Proceso")).toBe("En Aduana");
  });
});
