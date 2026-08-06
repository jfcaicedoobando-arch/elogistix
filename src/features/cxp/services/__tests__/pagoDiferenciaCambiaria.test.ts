import { describe, it, expect } from "vitest";
import { sugerirDiferenciaCambiaria } from "../pagoDiferenciaCambiaria";

describe("sugerirDiferenciaCambiaria", () => {
  it("calcula la diferencia entre el TC del pago y el de la factura", () => {
    expect(
      sugerirDiferenciaCambiaria({ montoEnMonedaFactura: 1000, tcPago: 18, tcFactura: 17.5 }),
    ).toBe(500);
  });

  it("devuelve negativo cuando el peso se fortalece", () => {
    expect(
      sugerirDiferenciaCambiaria({ montoEnMonedaFactura: 500, tcPago: 17, tcFactura: 17.4 }),
    ).toBe(-200);
  });

  it("devuelve null sin TC válido o sin monto", () => {
    expect(sugerirDiferenciaCambiaria({ montoEnMonedaFactura: 100, tcPago: null, tcFactura: 17 })).toBeNull();
    expect(sugerirDiferenciaCambiaria({ montoEnMonedaFactura: 100, tcPago: 17, tcFactura: 0 })).toBeNull();
    expect(sugerirDiferenciaCambiaria({ montoEnMonedaFactura: 0, tcPago: 17, tcFactura: 18 })).toBeNull();
  });

  it("redondea a centavos", () => {
    expect(
      sugerirDiferenciaCambiaria({ montoEnMonedaFactura: 333.33, tcPago: 17.1234, tcFactura: 17 }),
    ).toBe(41.13);
  });
});
