import { describe, expect, it } from "vitest";
import { totalesMargenUSD } from "../totalesMargenUSD";
import { evaluarMargenMinimo } from "@/lib/domain/margenMinimo";

describe("totalesMargenUSD (margen mínimo al guardar embarque)", () => {
  it("venta 2,000 USD y costo 30,000 MXN a TC 18.75 da 20% de margen, no -1400%", () => {
    const t = totalesMargenUSD([{ cantidad: 1, precioUnitario: 2000, moneda: "USD" }], [{ monto: 30000, moneda: "MXN" }], "18.75", "");
    expect(t).toEqual({ ventaUSD: 2000, costoUSD: 1600 });
    expect(evaluarMargenMinimo(t!.ventaUSD, t!.costoUSD, 8).debajoDelMinimo).toBe(false);
  });

  it("venta 37,500 MXN y costo 1,900 USD a TC 18.75 (5%) sí queda debajo del 8%", () => {
    const t = totalesMargenUSD([{ cantidad: 1, precioUnitario: 37500, moneda: "MXN" }], [{ monto: 1900, moneda: "USD" }], 18.75, 0);
    expect(t).toEqual({ ventaUSD: 2000, costoUSD: 1900 });
    expect(evaluarMargenMinimo(t!.ventaUSD, t!.costoUSD, 8).debajoDelMinimo).toBe(true);
  });

  it("monedas mezcladas sin tipo de cambio no se pueden evaluar", () => {
    expect(totalesMargenUSD([{ precioUnitario: 2000, moneda: "USD" }], [{ monto: 30000, moneda: "MXN" }], "", "")).toBeNull();
  });

  it("todo en USD no necesita tipo de cambio", () => {
    expect(totalesMargenUSD([{ cantidad: 2, precioUnitario: 7285, moneda: "USD" }], [{ monto: 13025, moneda: "USD" }], "", "")).toEqual({ ventaUSD: 14570, costoUSD: 13025 });
  });
});
