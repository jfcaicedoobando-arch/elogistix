import { describe, expect, it } from "vitest";
import { sumarConceptosVentaPorMoneda } from "../resumenConceptosVenta.helpers";

describe("totales con IVA de conceptos de venta", () => {
  it("distingue un concepto gravado y uno exento", () => {
    const total = sumarConceptosVentaPorMoneda([
      { cantidad: 1, precio_unitario: 100, moneda: "MXN", aplica_iva: true },
      { cantidad: 1, precio_unitario: 50, moneda: "MXN", aplica_iva: false },
      { cantidad: 2, precio_unitario: 10, moneda: "USD", aplica_iva: false },
    ], 0.16);
    expect(total).toEqual({ totalMxn: 166, totalUsd: 20 });
  });
});