/**
 * Lote P2 (item 6): "Total aplicado" no puede sumar sólo la moneda de la
 * primera fila; cada moneda lleva su propio subtotal.
 */
import { describe, it, expect } from "vitest";
import { subtotalesPorMoneda } from "../totalesAplicaciones";

describe("subtotalesPorMoneda", () => {
  it("una sola moneda: un subtotal", () => {
    expect(
      subtotalesPorMoneda([
        { monto_aplicado: 100, moneda_aplicada: "MXN" },
        { monto_aplicado: "50.5", moneda_aplicada: "MXN" },
      ]),
    ).toEqual([{ moneda: "MXN", total: 150.5 }]);
  });

  it("caso mixto: no mezcla monedas y no omite filas", () => {
    expect(
      subtotalesPorMoneda([
        { monto_aplicado: 100, moneda_aplicada: "MXN" },
        { monto_aplicado: 20, moneda_aplicada: "USD" },
        { monto_aplicado: 5, moneda_aplicada: "EUR" },
        { monto_aplicado: 10, moneda_aplicada: "USD" },
      ]),
    ).toEqual([
      { moneda: "EUR", total: 5 },
      { moneda: "MXN", total: 100 },
      { moneda: "USD", total: 30 },
    ]);
  });

  it("sin aplicaciones no hay subtotales", () => {
    expect(subtotalesPorMoneda([])).toEqual([]);
  });
});
