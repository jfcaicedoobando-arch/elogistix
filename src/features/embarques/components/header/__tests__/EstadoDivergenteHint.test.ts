/**
 * P2-6.5 — El chip sólo aparece cuando el estado calculado difiere del guardado.
 */
import { describe, it, expect } from "vitest";
import { hayDivergenciaEstado } from "../estadoDivergente";

describe("hayDivergenciaEstado", () => {
  it("no hay divergencia cuando coinciden", () => {
    expect(hayDivergenciaEstado("En Tránsito", "En Tránsito")).toBe(false);
  });

  it("hay divergencia cuando el calculado adelanta al guardado", () => {
    expect(hayDivergenciaEstado("En Tránsito", "Confirmado")).toBe(true);
  });

  it("ignora valores vacíos", () => {
    expect(hayDivergenciaEstado("", "Confirmado")).toBe(false);
    expect(hayDivergenciaEstado("Arribo", "")).toBe(false);
  });
});
