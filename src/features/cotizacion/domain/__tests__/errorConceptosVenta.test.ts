/**
 * v13.823.357 (Auditoría YAGNI P2 #6/#7 y P1 #1): el wizard valida los
 * conceptos de venta con el mismo contrato que la base.
 */
import { describe, it, expect } from "vitest";
import { errorConceptosVenta } from "../cotizacionVentaSync";

describe("errorConceptosVenta", () => {
  it("acepta renglones con cantidad y precio positivos", () => {
    expect(errorConceptosVenta([{ descripcion: "Flete", cantidad: 2, precio_unitario: 100, moneda: "USD" }])).toBeNull();
  });

  it("rechaza cantidad cero", () => {
    expect(errorConceptosVenta([
      { descripcion: "A", cantidad: 1, precio_unitario: 100 },
      { descripcion: "B", cantidad: 0, precio_unitario: 100 },
    ])).toMatch(/cantidad o precio/i);
  });

  it("rechaza precio negativo", () => {
    expect(errorConceptosVenta([
      { descripcion: "A", cantidad: 1, precio_unitario: 100 },
      { descripcion: "B", cantidad: 1, precio_unitario: -5 },
    ])).toMatch(/cantidad o precio/i);
  });

  it("rechaza cuando NINGÚN renglón tiene importe", () => {
    expect(errorConceptosVenta([{ descripcion: "A", cantidad: 1, precio_unitario: 0 }]))
      .toMatch(/Ningún concepto de venta/i);
  });

  it("rechaza moneda no soportada (EUR)", () => {
    expect(errorConceptosVenta([{ descripcion: "A", cantidad: 1, precio_unitario: 10, moneda: "EUR" }]))
      .toMatch(/pesos \(MXN\) o dólares \(USD\)/i);
  });

  it("sin renglones con descripción no opina (lo cubre el schema del paso)", () => {
    expect(errorConceptosVenta([{ descripcion: "  ", cantidad: 0, precio_unitario: 0 }])).toBeNull();
  });
});
