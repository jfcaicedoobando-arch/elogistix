import { describe, expect, it } from "vitest";
import type { FacturaLite } from "../reportesFetch";
import { agruparTopProveedores } from "../reportesAgregados";

function factura(overrides: Partial<FacturaLite> = {}): FacturaLite {
  return {
    id: "factura-eur", fecha_emision: "2026-10-04", total: 100, moneda: "EUR",
    proveedor_id: "proveedor-eur", proveedor_nombre: "Proveedor EUR",
    tipo_cambio_usd: 20, ...overrides,
  };
}

describe("Top proveedores — TC documental (extensión 106)", () => {
  it("EUR 100 × TC documental 20 equivale a MXN 2000 aunque el DOF sea distinto", () => {
    const rows = [factura()];
    const original = structuredClone(rows);

    expect(agruparTopProveedores(rows, 18, 30)).toEqual([{
      nombre: "Proveedor EUR", mxn: 0, usd: 0, eur: 100, count: 1, mxnEquiv: 2000,
    }]);
    expect(agruparTopProveedores(rows)[0].mxnEquiv).toBe(2000);
    expect(rows).toEqual(original);
  });

  it("ordena por equivalente documental y conserva el desglose nominal", () => {
    const result = agruparTopProveedores([
      factura(),
      factura({ id: "factura-mxn", moneda: "MXN", total: 2100, proveedor_id: "otro", proveedor_nombre: "Local", tipo_cambio_usd: null }),
      factura({ id: "factura-usd", moneda: "USD", total: 2, tipo_cambio_usd: 18 }),
    ], 25, 30);

    expect(result).toEqual([
      { nombre: "Local", mxn: 2100, usd: 0, eur: 0, count: 1, mxnEquiv: 2100 },
      { nombre: "Proveedor EUR", mxn: 0, usd: 2, eur: 100, count: 2, mxnEquiv: 2036 },
    ]);
  });

  it.each([null, 0, -20, 1, 0.5, NaN, Infinity])(
    "usa respaldo específico de la moneda cuando el TC documental es inválido: %s",
    (tipo_cambio_usd) => {
      expect(agruparTopProveedores([factura({ tipo_cambio_usd })], 18, 22)[0].mxnEquiv).toBe(2200);
      expect(agruparTopProveedores([factura({ moneda: "USD", tipo_cambio_usd })], 18, 22)[0].mxnEquiv).toBe(1800);
    },
  );

  it.each([undefined, 0, -20, 1, NaN, Infinity])(
    "sin TC documental ni respaldo confiable conserva EUR nominal y no inventa MXN: %s",
    (tcEurDof) => {
      expect(agruparTopProveedores([factura({ tipo_cambio_usd: null })], 18, tcEurDof)).toEqual([{
        nombre: "Proveedor EUR", mxn: 0, usd: 0, eur: 100, count: 1, mxnEquiv: 0,
      }]);
    },
  );
});
