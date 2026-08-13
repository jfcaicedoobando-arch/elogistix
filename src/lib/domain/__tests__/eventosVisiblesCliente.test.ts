/**
 * P2-6.4 — Sólo hitos de negocio llegan al timeline del portal.
 */
import { describe, it, expect } from "vitest";
import {
  esEventoVisibleCliente,
  filtrarEventosVisiblesCliente,
} from "../eventosVisiblesCliente";

describe("eventosVisiblesCliente", () => {
  it("acepta hitos de negocio", () => {
    expect(esEventoVisibleCliente({ tipo: "Zarpe" })).toBe(true);
    expect(esEventoVisibleCliente({ tipo: "Entrega" })).toBe(true);
  });

  it("descarta tipos internos u operativos", () => {
    expect(esEventoVisibleCliente({ tipo: "Otro" })).toBe(false);
    expect(esEventoVisibleCliente({ tipo: "Demora" })).toBe(false);
    expect(esEventoVisibleCliente({ tipo: "Inspección" })).toBe(false);
  });

  it("descarta eventos con marca interna en descripción o usuario", () => {
    expect(esEventoVisibleCliente({ tipo: "Zarpe", descripcion: "[interno] revisar" })).toBe(false);
    expect(esEventoVisibleCliente({ tipo: "Zarpe", usuario: "harness-e2e" })).toBe(false);
  });

  it("filtra una lista completa", () => {
    const res = filtrarEventosVisiblesCliente([
      { tipo: "Zarpe" },
      { tipo: "Otro" },
      { tipo: "Arribo a Puerto", descripcion: "SEED de prueba" },
      { tipo: "Entrega" },
    ]);
    expect(res.map((e) => e.tipo)).toEqual(["Zarpe", "Entrega"]);
  });
});
