/**
 * B.3 (R3-BL-1): una divisa fuera de MXN/USD/EUR no se puede convertir, así que
 * `sumarEnMoneda` debe fallar fuerte. Antes se trataba como si ya estuviera en
 * la moneda destino y el total quedaba inflado.
 */
import { describe, it, expect } from "vitest";
import { sumarEnMoneda } from "@/lib/financial/costosUSD";

describe("sumarEnMoneda · moneda no soportada", () => {
  it("lanza cuando una fila viene en una divisa desconocida", () => {
    expect(() =>
      sumarEnMoneda([{ monto: 100, moneda: "GBP" }], "USD", 18, 20),
    ).toThrow(/Moneda no soportada/);
  });

  it("sigue sumando normal cuando todas las divisas son soportadas", () => {
    const res = sumarEnMoneda(
      [{ monto: 100, moneda: "USD" }, { monto: 1800, moneda: "MXN" }],
      "USD",
      18,
      20,
    );
    expect(res.total).toBeCloseTo(200, 2);
  });
});
