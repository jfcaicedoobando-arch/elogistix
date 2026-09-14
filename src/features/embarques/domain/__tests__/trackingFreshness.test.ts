/**
 * v13.823.370 (P2-3) — Un Borrador sin eventos está "pendiente de iniciar
 * seguimiento", no "requiere actualización".
 */
import { describe, it, expect } from "vitest";
import { computeFreshness } from "../trackingFreshness";

const SIN_EVENTOS: Array<{ fecha: string; tipo: string; ubicacion: string | null }> = [];

describe("computeFreshness · sin eventos", () => {
  it("Borrador: copy neutral y sin badge de advertencia", () => {
    const f = computeFreshness(SIN_EVENTOS, null, false, "Borrador");
    expect(f.label).toBe("Pendiente de iniciar seguimiento");
    expect(f.critical).toBe(false);
    expect(f.etaProxima).toBe(false);
  });

  it("Borrador en minúsculas / con espacios también se reconoce", () => {
    expect(computeFreshness(SIN_EVENTOS, null, false, "  borrador ").critical).toBe(false);
  });

  it("Confirmado: conserva la advertencia", () => {
    const f = computeFreshness(SIN_EVENTOS, null, false, "Confirmado");
    expect(f.label).toBe("Sin eventos registrados");
    expect(f.critical).toBe(true);
  });

  it("Sin estado conocido: comportamiento histórico (advierte)", () => {
    expect(computeFreshness(SIN_EVENTOS, null, false).critical).toBe(true);
  });

  it("Arribado sin eventos: no advierte (comportamiento previo)", () => {
    expect(computeFreshness(SIN_EVENTOS, null, true, "Entregado").critical).toBe(false);
  });
});

describe("computeFreshness · con eventos", () => {
  it("el estado no altera el cálculo cuando ya hay eventos", () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const eventos = [{ fecha: hoy, tipo: "Salida", ubicacion: "Apodaca" }];
    const borrador = computeFreshness(eventos, null, false, "Borrador");
    const confirmado = computeFreshness(eventos, null, false, "Confirmado");
    expect(borrador).toEqual(confirmado);
    expect(borrador.label).toContain("Último evento hoy");
  });
});
