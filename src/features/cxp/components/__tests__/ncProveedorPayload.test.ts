import { describe, expect, it } from "vitest";
import { construirNcProveedorPayload } from "../ncProveedorPayload";
import type { MonedaNotaCreditoProveedor } from "../../types";

const datos = {
  facturaId: "factura", folio: " NC-1 ", fecha: "2026-10-05", monto: 116,
  subtotal: 100, motivo: "Bonificacion" as const, descripcion: "Base100 más IVA16",
  uuidFiscal: null, tipoCambio: 20,
};
describe("payload de NC proveedor", () => {
  it.each<{
    moneda: MonedaNotaCreditoProveedor; monedaFactura: MonedaNotaCreditoProveedor;
    conversion: number | null; valuacion: number;
  }>([
    { moneda: "EUR", monedaFactura: "EUR", conversion: null, valuacion: 20 },
    { moneda: "USD", monedaFactura: "USD", conversion: null, valuacion: 20 },
    { moneda: "MXN", monedaFactura: "MXN", conversion: null, valuacion: 1 },
    { moneda: "MXN", monedaFactura: "EUR", conversion: 20, valuacion: 1 },
    { moneda: "EUR", monedaFactura: "MXN", conversion: 20, valuacion: 20 },
  ])("separa deuda y valuación de $moneda contra $monedaFactura", ({ moneda, monedaFactura, conversion, valuacion }) => {
    expect(construirNcProveedorPayload({ ...datos, moneda, monedaFactura })).toEqual({
      proveedor_factura_id: "factura", folio_nc: "NC-1", fecha: datos.fecha,
      monto: 116, subtotal: 100, motivo: datos.motivo, descripcion: datos.descripcion,
      uuid_fiscal: null, estado: "Borrador", moneda,
      tipo_cambio: conversion, tipo_cambio_mxn: valuacion,
    });
  });
});
