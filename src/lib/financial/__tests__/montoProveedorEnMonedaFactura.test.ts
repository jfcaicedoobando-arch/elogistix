import { describe, expect, it } from "vitest";
import { montoProveedorEnMonedaFactura } from "../montoProveedorEnMonedaFactura";
import { equivalenteNotaCredito } from "../notaCreditoEquivalente";

describe("55/58: canon de proveedor de cuatro argumentos", () => {
  it.each([
    [2000, "MXN", 20, "USD", 100], [2000, "MXN", 25, "USD", 80],
    [10, "USD", 20, "MXN", 200], [10, "EUR", 22, "MXN", 220],
    [220, "MXN", 22, "EUR", 10], [1, "MXN", 3, "USD", 0.3333],
    [100, "USD", null, "USD", 100], [100, "MXN", null, "MXN", 100],
    [100, "EUR", null, "EUR", 100],
  ] as const)("paridad SQL: %s %s TC%s a %s", (monto, moneda, tc, factura, esperado) => {
    expect(montoProveedorEnMonedaFactura(monto, moneda, tc, factura)).toBe(esperado);
  });
  it.each([null, 0, -20, Number.NaN, Number.POSITIVE_INFINITY])("sin TC válido %s devuelve no disponible", (tc) => {
    expect(montoProveedorEnMonedaFactura(2000, "MXN", tc, "USD")).toBeNull();
    expect(montoProveedorEnMonedaFactura(100, "USD", tc, "MXN")).toBeNull();
  });
  it.each([["USD", "EUR"], ["EUR", "USD"]])("no inventa una tasa cruzada %s/%s", (origen, destino) => {
    expect(montoProveedorEnMonedaFactura(100, origen, 20, destino)).toBeNull();
  });
  it.each([10, 20, 99, null])("el TC de factura %s no reemplaza el TC25 de la NC", (tcFactura) => {
    expect(equivalenteNotaCredito({ monto: 2000, moneda: "MXN", tipo_cambio: 25 }, { moneda: "USD", tipo_cambio_usd: tcFactura })).toBe(80);
  });
  it("aplica el redondeo a cuatro decimales de PostgreSQL antes de sumar NC", () => {
    expect(montoProveedorEnMonedaFactura(0.00005, "USD", 3, "MXN")).toBe(0.0002);
    expect(montoProveedorEnMonedaFactura(-0.00005, "USD", 3, "MXN")).toBe(-0.0002);
  });
});
