/**
 * MNY P1.3 · el tope aplicable se calcula en la moneda del ANTICIPO usando el
 * DOF de la fecha de aplicación. Caso de control del hallazgo:
 *   DOF usd=17.3370 / eur=20.0000 → 100 USD = 86.6850 EUR
 *   ruta histórica con T/C de factura 18.00 → 95.2928 EUR (ya no se usa)
 */
import { describe, it, expect } from "vitest";
import {
  calcularTopeAplicable,
  convertirMoneda,
  tcAMxn,
} from "../topeAplicacionAnticipo";

const DOF = { usdMxn: 17.337, eurMxn: 20 };

describe("topeAplicacionAnticipo", () => {
  it("convierte USD→EUR con el DOF del día (86.6850, no 95.2928)", () => {
    expect(convertirMoneda(100, "USD", "EUR", DOF)).toBe(86.685);
    expect(convertirMoneda(100, "USD", "EUR", DOF)).not.toBe(95.2928);
  });

  it("tcAMxn: MXN vale 1 y una divisa sin paridad publicada es null", () => {
    expect(tcAMxn("MXN", null)).toBe(1);
    expect(tcAMxn("USD", DOF)).toBe(17.337);
    expect(tcAMxn("EUR", { usdMxn: 17.337, eurMxn: null })).toBeNull();
    expect(tcAMxn("GBP", DOF)).toBeNull();
  });

  it("tope de un anticipo USD sobre factura EUR: el saldo se convierte", () => {
    // Saldo factura 50 EUR = 57.6801 USD → el tope es el mínimo contra el disponible.
    const r = calcularTopeAplicable({
      disponible: 100,
      monedaAnticipo: "USD",
      saldoFactura: 50,
      monedaFactura: "EUR",
      tc: DOF,
    });
    expect(r.requiereConversion).toBe(true);
    expect(r.sinTipoCambio).toBe(false);
    expect(r.saldoFacturaEnMonedaAnticipo).toBe(57.68);
    expect(r.tope).toBe(57.68);
  });

  it("no deja aplicar 100 USD contra un saldo de 100 EUR (antes sí)", () => {
    const r = calcularTopeAplicable({
      disponible: 100,
      monedaAnticipo: "USD",
      saldoFactura: 100,
      monedaFactura: "EUR",
      tc: DOF,
    });
    expect(r.tope).toBe(100); // disponible manda: 100 EUR = 115.36 USD
    const inverso = calcularTopeAplicable({
      disponible: 100,
      monedaAnticipo: "EUR",
      saldoFactura: 100,
      monedaFactura: "USD",
      tc: DOF,
    });
    expect(inverso.tope).toBe(86.68); // 100 USD = 86.685 EUR, truncado a 2
  });

  it("sin paridad publicada falla cerrado (tope null, nunca 1:1)", () => {
    const r = calcularTopeAplicable({
      disponible: 100,
      monedaAnticipo: "USD",
      saldoFactura: 50,
      monedaFactura: "EUR",
      tc: { usdMxn: 17.337, eurMxn: null },
    });
    expect(r.tope).toBeNull();
    expect(r.sinTipoCambio).toBe(true);
    expect(r.saldoFacturaEnMonedaAnticipo).toBeNull();
  });

  it("misma moneda no requiere tipo de cambio", () => {
    const r = calcularTopeAplicable({
      disponible: 100,
      monedaAnticipo: "MXN",
      saldoFactura: 40,
      monedaFactura: "MXN",
      tc: null,
    });
    expect(r.requiereConversion).toBe(false);
    expect(r.tope).toBe(40);
  });
});
