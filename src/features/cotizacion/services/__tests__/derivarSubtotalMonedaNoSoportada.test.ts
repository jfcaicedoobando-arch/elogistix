/**
 * v13.823.357 (Auditoría YAGNI P2 #7): una moneda distinta de MXN/USD ya no se
 * suma como dólares en silencio.
 */
import { describe, it, expect } from "vitest";
import { derivarSubtotalMoneda, MSG_MONEDA_NO_SOPORTADA } from "../derivarSubtotalMoneda";

describe("derivarSubtotalMoneda — moneda no soportada", () => {
  it("rechaza un renglón en EUR", () => {
    expect(() =>
      derivarSubtotalMoneda([{ descripcion: "A", cantidad: 1, precio_unitario: 100, moneda: "EUR" }]),
    ).toThrow(MSG_MONEDA_NO_SOPORTADA);
  });

  it("acepta MXN y USD (incluida minúscula)", () => {
    expect(derivarSubtotalMoneda([{ cantidad: 2, precio_unitario: 50, moneda: "mxn" }])).toEqual({
      subtotal: 100,
      moneda: "MXN",
    });
    expect(derivarSubtotalMoneda([{ cantidad: 1, precio_unitario: 80, moneda: "USD" }])).toEqual({
      subtotal: 80,
      moneda: "USD",
    });
  });

  it("sin moneda capturada conserva el default USD", () => {
    expect(derivarSubtotalMoneda([{ cantidad: 1, precio_unitario: 10 }])).toEqual({
      subtotal: 10,
      moneda: "USD",
    });
  });
});
