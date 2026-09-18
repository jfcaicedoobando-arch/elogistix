/**
 * P2 · Auditoría IVA — el IVA por partida se leía sólo del CFDI, así que una
 * captura manual con IVA por renglón se reportaba como "no desglosado".
 */
import { describe, it, expect } from "vitest";
import { sumarIvaPartidasVisibles } from "../conceptosParaCuadre";

describe("sumarIvaPartidasVisibles", () => {
  it("suma el IVA del CFDI cuando el origen es XML/PDF con IA", () => {
    expect(
      sumarIvaPartidasVisibles([{ iva: 160 }, { iva: 80 }], [{ iva: 999 }]),
    ).toBe(240);
  });

  it("suma el IVA de los conceptos manuales cuando no hay CFDI", () => {
    expect(sumarIvaPartidasVisibles([], [{ iva: 160 }, { iva: "40" }])).toBe(200);
  });

  it("no duplica: con CFDI presente los manuales se ignoran", () => {
    expect(sumarIvaPartidasVisibles([{ iva: 100 }], [{ iva: 100 }])).toBe(100);
  });

  it("renglones sin IVA capturado cuentan como cero", () => {
    expect(sumarIvaPartidasVisibles([], [{ iva: null }, {}, { iva: 16 }])).toBe(16);
    expect(sumarIvaPartidasVisibles([], [])).toBe(0);
  });
});
