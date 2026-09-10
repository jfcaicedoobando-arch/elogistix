import { describe, it, expect } from "vitest";
import { ivaExcedeTasaMaxima, ivaMaximoAceptable } from "../ivaPlausible";

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

  it("expone el máximo aceptable con tolerancia", () => {
    expect(ivaMaximoAceptable(100)).toBeCloseTo(16.02, 2);
  });
});
