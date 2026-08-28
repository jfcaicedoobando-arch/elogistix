/**
 * Ola 17 · H8-B: una NC en moneda distinta a la factura debe valuarse con TC DOF
 * (MXN por 1 USD/EUR) y nunca asumir 1:1.
 */
import { describe, it, expect } from "vitest";
import {
  esCruceNoConvertible,
  monedaExtranjeraDelPar,
  montoNcEnMonedaFactura,
} from "../ncMonedaProveedor";

describe("ncMonedaProveedor", () => {
  it("marca USD↔EUR como cruce no convertible", () => {
    expect(esCruceNoConvertible("USD", "EUR")).toBe(true);
    expect(esCruceNoConvertible("USD", "MXN")).toBe(false);
    expect(esCruceNoConvertible("MXN", "MXN")).toBe(false);
  });

  it("identifica la moneda extranjera del par", () => {
    expect(monedaExtranjeraDelPar("MXN", "USD")).toBe("USD");
    expect(monedaExtranjeraDelPar("EUR", "MXN")).toBe("EUR");
    expect(monedaExtranjeraDelPar("USD", "USD")).toBeNull();
    expect(monedaExtranjeraDelPar("USD", "EUR")).toBeNull();
  });

  it("convierte extranjera → MXN multiplicando por el TC", () => {
    expect(montoNcEnMonedaFactura(100, "USD", "MXN", 18.5)).toBeCloseTo(1850, 6);
  });

  it("convierte MXN → extranjera dividiendo entre el TC", () => {
    expect(montoNcEnMonedaFactura(1850, "MXN", "USD", 18.5)).toBeCloseTo(100, 6);
  });

  it("devuelve el monto tal cual cuando la moneda coincide", () => {
    expect(montoNcEnMonedaFactura(500, "USD", "USD", null)).toBe(500);
  });

  it("devuelve null sin TC válido o con cruce imposible", () => {
    expect(montoNcEnMonedaFactura(100, "USD", "MXN", null)).toBeNull();
    expect(montoNcEnMonedaFactura(100, "USD", "MXN", 0)).toBeNull();
    expect(montoNcEnMonedaFactura(100, "USD", "EUR", 18.5)).toBeNull();
    expect(montoNcEnMonedaFactura(Number.NaN, "USD", "MXN", 18.5)).toBeNull();
  });
});
