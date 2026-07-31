import { describe, it, expect } from "vitest";
import { getSiguienteEstado } from "@/features/embarques/hooks/useEmbarqueEstadoActions.helpers";

/**
 * v13.303.22 — `getSiguienteEstado` debe respetar el happy path actual de la
 * máquina de estados de BD: Borrador → Confirmado → En Tránsito → Arribo →
 * En Aduana → Entregado → EIR → Cerrado. (Estados deprecados: `Cotización`,
 * `Llegada`.)
 */
describe("getSiguienteEstado — happy path alineado con máquina de estados BD", () => {
  it("Borrador → Confirmado", () => {
    expect(getSiguienteEstado("Borrador")).toBe("Confirmado");
  });
  it("Cotización → Confirmado (rescate de embarques legacy)", () => {
    expect(getSiguienteEstado("Cotización")).toBe("Confirmado");
  });
  it("Confirmado → En Tránsito", () => {
    expect(getSiguienteEstado("Confirmado")).toBe("En Tránsito");
  });
  it("En Tránsito → Arribo (nuevo orden v13.303.22)", () => {
    expect(getSiguienteEstado("En Tránsito")).toBe("Arribo");
  });
  it("Arribo → En Aduana (nuevo orden v13.303.22)", () => {
    expect(getSiguienteEstado("Arribo")).toBe("En Aduana");
  });
  it("En Aduana → Entregado (nuevo orden v13.303.22)", () => {
    expect(getSiguienteEstado("En Aduana")).toBe("Entregado");
  });
  it("Llegada → Arribo (rescate de embarques legacy)", () => {
    expect(getSiguienteEstado("Llegada")).toBe("Arribo");
  });
  it("Entregado → EIR", () => {
    expect(getSiguienteEstado("Entregado")).toBe("EIR");
  });
  it("EIR → Por liquidar (cierre administrativo, v13.380.0)", () => {
    expect(getSiguienteEstado("EIR")).toBe("Por liquidar");
  });
  it("Por liquidar → Cerrado", () => {
    expect(getSiguienteEstado("Por liquidar")).toBe("Cerrado");
  });
  it("Cerrado no tiene siguiente", () => {
    expect(getSiguienteEstado("Cerrado")).toBeNull();
  });
  it("estado desconocido retorna null", () => {
    expect(getSiguienteEstado("Inexistente")).toBeNull();
  });
  it("En Proceso → Arribo (estado lateral del grafo BD, v13.303.22)", () => {
    expect(getSiguienteEstado("En Proceso")).toBe("Arribo");
  });
});
