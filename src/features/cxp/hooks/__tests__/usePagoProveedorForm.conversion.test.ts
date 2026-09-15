/**
 * MNY-NEW-09 — una sola conversión para vista previa, validación y envío.
 * Antes `montoEnMonedaDeFactura` devolvía el monto 1:1 en cualquier cruce que
 * no fuera "factura extranjera pagada en MXN", así que una factura EUR pagada
 * en MXN (o un cruce USD↔EUR) mostraba equivalencias falsas.
 */
import { describe, it, expect } from "vitest";
import {
  montoEnMonedaDeFactura,
  cruceMonedasNoSoportado,
} from "../usePagoProveedorForm.editar";

describe("montoEnMonedaDeFactura", () => {
  it("misma moneda del pago y la factura: monto tal cual", () => {
    expect(
      montoEnMonedaDeFactura({ monedaFactura: "USD", monedaPago: "USD", monto: 100, tcNum: 18 }),
    ).toBe(100);
  });

  it("USD↔MXN: pago en pesos se divide entre el T.C.", () => {
    expect(
      montoEnMonedaDeFactura({ monedaFactura: "USD", monedaPago: "MXN", monto: 1800, tcNum: 18 }),
    ).toBe(100);
  });

  it("EUR↔MXN: pago en pesos usa el T.C. del euro", () => {
    expect(
      montoEnMonedaDeFactura({ monedaFactura: "EUR", monedaPago: "MXN", monto: 2000, tcNum: 20 }),
    ).toBe(100);
  });

  it("factura MXN pagada en divisa: multiplica por el T.C.", () => {
    expect(
      montoEnMonedaDeFactura({ monedaFactura: "MXN", monedaPago: "EUR", monto: 100, tcNum: 20 }),
    ).toBe(2000);
  });

  it("USD↔EUR: cruce no soportado, nunca 1:1", () => {
    expect(
      montoEnMonedaDeFactura({ monedaFactura: "EUR", monedaPago: "USD", monto: 100, tcNum: 18 }),
    ).toBe(0);
    expect(
      montoEnMonedaDeFactura({ monedaFactura: "USD", monedaPago: "EUR", monto: 100, tcNum: 18 }),
    ).toBe(0);
  });

  it("sin T.C. no inventa equivalencia", () => {
    expect(
      montoEnMonedaDeFactura({ monedaFactura: "USD", monedaPago: "MXN", monto: 1800, tcNum: null }),
    ).toBe(0);
  });
});

describe("cruceMonedasNoSoportado", () => {
  it("marca sólo cruces divisa↔divisa distintas", () => {
    expect(cruceMonedasNoSoportado("USD", "EUR")).toBe(true);
    expect(cruceMonedasNoSoportado("EUR", "USD")).toBe(true);
    expect(cruceMonedasNoSoportado("USD", "MXN")).toBe(false);
    expect(cruceMonedasNoSoportado("MXN", "EUR")).toBe(false);
    expect(cruceMonedasNoSoportado("USD", "USD")).toBe(false);
    expect(cruceMonedasNoSoportado(null, "USD")).toBe(false);
  });
});
