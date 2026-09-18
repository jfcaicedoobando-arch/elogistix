import { describe, it, expect } from "vitest";
import { ivaExcedeTasaMaxima, ivaMaximoAceptable, baseGravableIva } from "../ivaPlausible";

describe("ivaPlausible (FP-000256)", () => {
  it("bloquea el IVA fantasma de 50 sobre un subtotal de 60", () => {
    expect(ivaExcedeTasaMaxima(60, 50)).toBe(true);
  });

  it("acepta el 16% exacto y tolera el redondeo a centavos", () => {
    expect(ivaExcedeTasaMaxima(30000, 4800)).toBe(false);
    expect(ivaExcedeTasaMaxima(78.14, 12.5)).toBe(false);
    expect(ivaExcedeTasaMaxima(100, 16.01)).toBe(false);
  });

  it("acepta facturas extranjeras sin impuesto", () => {
    expect(ivaExcedeTasaMaxima(60, 0)).toBe(false);
    expect(ivaExcedeTasaMaxima(0, 0)).toBe(false);
  });

  it("bloquea IVA capturado sin subtotal", () => {
    expect(ivaExcedeTasaMaxima(0, 10)).toBe(true);
  });

  it("P1: el IEPS forma parte de la base gravable (subtotal 100 + IEPS 8 admite 17.28)", () => {
    expect(ivaExcedeTasaMaxima(100, 17.28, 8)).toBe(false);
    expect(ivaExcedeTasaMaxima(100, 17.28)).toBe(true);
    expect(baseGravableIva(100, 8)).toBe(108);
  });

  it("sigue bloqueando un IVA imposible aunque haya IEPS capturado", () => {
    expect(ivaExcedeTasaMaxima(100, 40, 8)).toBe(true);
  });

  it("expone el máximo aceptable con tolerancia", () => {
    expect(ivaMaximoAceptable(100)).toBeCloseTo(16.02, 2);
    expect(ivaMaximoAceptable(100, 8)).toBeCloseTo(17.3, 2);
  });
});
