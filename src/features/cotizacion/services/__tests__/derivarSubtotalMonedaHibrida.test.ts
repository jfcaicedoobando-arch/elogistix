/**
 * 13.823.281 — Cotización híbrida USD+MXN: el TC congelado sólo normaliza el
 * subtotal del encabezado; sin TC se sigue bloqueando el guardado.
 */
import { describe, it, expect } from "vitest";
import {
  derivarSubtotalMoneda,
  MSG_COTIZACION_MIXTA,
} from "@/features/cotizacion/services/derivarSubtotalMoneda";
import { hayMezclaDeMonedas } from "@/features/cotizacion/domain/mezclaMonedas";

const usd = { moneda: "USD", total: 100 };
const mxn = { moneda: "MXN", total: 1000 };

describe("derivarSubtotalMoneda — híbrida", () => {
  it("bloquea la mezcla cuando no hay tipo de cambio", () => {
    expect(() => derivarSubtotalMoneda([usd, mxn], "MXN", null)).toThrow(MSG_COTIZACION_MIXTA);
  });

  it("convierte a MXN con el TC capturado", () => {
    const r = derivarSubtotalMoneda([usd, mxn], "MXN", 20);
    expect(r).toEqual({ subtotal: 3000, moneda: "MXN" });
  });

  it("convierte a USD cuando la moneda canónica es USD", () => {
    const r = derivarSubtotalMoneda([usd, mxn], "USD", 20);
    expect(r).toEqual({ subtotal: 150, moneda: "USD" });
  });

  it("no exige TC cuando todo está en una sola moneda", () => {
    expect(derivarSubtotalMoneda([usd], "USD")).toEqual({ subtotal: 100, moneda: "USD" });
    expect(derivarSubtotalMoneda([mxn], "MXN")).toEqual({ subtotal: 1000, moneda: "MXN" });
  });
});

describe("hayMezclaDeMonedas", () => {
  it("sólo es verdadero con importes positivos en ambas monedas", () => {
    expect(hayMezclaDeMonedas([usd], [mxn])).toBe(true);
    expect(hayMezclaDeMonedas([usd], [{ total: 0 }])).toBe(false);
    expect(hayMezclaDeMonedas([], [mxn])).toBe(false);
  });
});
