/**
 * C3 — el saldo de una factura de proveedor debe sumar los pagos convertidos a
 * la moneda de la factura (`monto_en_moneda_factura`), no el importe crudo.
 */
import { describe, it, expect } from "vitest";
import {
  sumarPagosEnMonedaFactura,
  type PagoCxpParcial,
} from "../proveedorFacturas.helpers";

const pago = (p: Partial<PagoCxpParcial>): PagoCxpParcial => ({
  monto: 0,
  monto_en_moneda_factura: null,
  deleted_at: null,
  ...p,
});

describe("sumarPagosEnMonedaFactura", () => {
  it("usa monto_en_moneda_factura cuando el pago va en otra moneda", () => {
    // Factura USD 1,000 pagada con MXN 8,500 (TC 17): aplica 500 USD.
    const total = sumarPagosEnMonedaFactura([
      pago({ monto: 8500, monto_en_moneda_factura: 500 }),
    ]);
    expect(total).toBe(500);
  });

  it("no marca la factura como liquidada por sumar pesos contra dólares", () => {
    const pagado = sumarPagosEnMonedaFactura([
      pago({ monto: 8500, monto_en_moneda_factura: 500 }),
    ]);
    expect(Math.max(0, 1000 - pagado)).toBe(500);
  });

  it("cae a `monto` cuando pago y factura comparten moneda", () => {
    expect(sumarPagosEnMonedaFactura([pago({ monto: 300 })])).toBe(300);
  });

  it("ignora pagos con baja lógica", () => {
    const total = sumarPagosEnMonedaFactura([
      pago({ monto: 100, monto_en_moneda_factura: 100 }),
      pago({ monto: 999, monto_en_moneda_factura: 999, deleted_at: "2026-01-01" }),
    ]);
    expect(total).toBe(100);
  });

  it("devuelve 0 sin pagos", () => {
    expect(sumarPagosEnMonedaFactura(null)).toBe(0);
    expect(sumarPagosEnMonedaFactura([])).toBe(0);
  });
});
