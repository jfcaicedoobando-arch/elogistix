/**
 * Ola E1 · N22 — un movimiento bancario es cargo O abono, nunca ambos ni negativo.
 */
import { describe, it, expect } from "vitest";
import { validarCargoAbono } from "../conciliacionManual";

describe("validarCargoAbono", () => {
  it("acepta un cargo puro", () => {
    expect(validarCargoAbono(1500, 0)).toBeNull();
  });

  it("acepta un abono puro", () => {
    expect(validarCargoAbono(0, 980.55)).toBeNull();
  });

  it("rechaza cargo y abono simultáneos", () => {
    expect(validarCargoAbono(100, 100)).toMatch(/cargo o abono/i);
  });

  it("rechaza importes negativos", () => {
    expect(validarCargoAbono(-1, 0)).toMatch(/negativos/i);
    expect(validarCargoAbono(0, -5)).toMatch(/negativos/i);
  });

  it("rechaza el movimiento en cero", () => {
    expect(validarCargoAbono(0, 0)).toMatch(/importe/i);
  });

  it("rechaza valores no numéricos", () => {
    expect(validarCargoAbono(Number.NaN, 0)).toMatch(/numéricos/i);
    expect(validarCargoAbono(0, Number.POSITIVE_INFINITY)).toMatch(/numéricos/i);
  });
});
