/**
 * Ola v13.823.7 · P1/P2 moneda: el fallback de TC se elige POR MONEDA.
 * Antes cualquier divisa usaba el fallback USD, así que una factura EUR sin
 * `tipo_cambio` se valuaba con el TC del dólar (cifra creíble pero falsa).
 */
import { describe, it, expect } from "vitest";
import { fallbackDeMoneda, mesMasOffset, mxnFactura, toMxn, ventanaDireccionDesdeIso } from "../mxn";

describe("mxnFactura: fallback por moneda", () => {
  it("MXN no depende de fallbacks", () => {
    expect(mxnFactura(1000, "MXN", null, {})).toBe(1000);
    expect(mxnFactura(1000, "MXN", null, { usd: 18, eur: 22 })).toBe(1000);
  });

  it("USD sin TC usa el fallback USD", () => {
    expect(mxnFactura(100, "USD", null, { usd: 18, eur: 22 })).toBeCloseTo(1800, 2);
  });

  it("USD con TC de factura: el TC de la factura prevalece", () => {
    expect(mxnFactura(100, "USD", 20, { usd: 18 })).toBeCloseTo(2000, 2);
  });

  it("EUR sin TC y con fallback USD pero SIN fallback EUR => 0 (no EUR × USD)", () => {
    expect(mxnFactura(100, "EUR", null, { usd: 18 })).toBe(0);
    expect(mxnFactura(100, "EUR", null, { usd: 18, eur: null })).toBe(0);
  });

  it("EUR sin TC con fallback EUR => usa el fallback EUR", () => {
    expect(mxnFactura(100, "EUR", null, { usd: 18, eur: 22 })).toBeCloseTo(2200, 2);
  });

  it("EUR con TC de factura: prevalece sobre el fallback EUR", () => {
    expect(mxnFactura(100, "EUR", 21, { usd: 18, eur: 22 })).toBeCloseTo(2100, 2);
  });

  it("divisa desconocida sin TC no contamina KPIs", () => {
    expect(mxnFactura(100, "JPY", null, { usd: 18, eur: 22 })).toBe(0);
    expect(fallbackDeMoneda("JPY", { usd: 18, eur: 22 })).toBeNull();
  });

  it("divisa desconocida CON TC directo válido tampoco entra (JPY)", () => {
    expect(mxnFactura(100, "JPY", 3, { usd: 18, eur: 22 })).toBe(0);
    expect(mxnFactura(100, "jpy", 3, {})).toBe(0);
    expect(mxnFactura(100, "GBP", 25, { usd: 18 })).toBe(0);
  });

  it("toMxn ignora divisas fuera de MXN/USD/EUR aunque haya TC", () => {
    expect(toMxn(100, "JPY", 18, 22)).toBe(0);
    expect(toMxn(100, "usd", 18, 22)).toBeCloseTo(1800, 2);
    expect(toMxn(100, "eur", 18, 22)).toBeCloseTo(2200, 2);
  });


  it("fallbackDeMoneda entrega el TC de la moneda pedida", () => {
    expect(fallbackDeMoneda("USD", { usd: 18, eur: 22 })).toBe(18);
    expect(fallbackDeMoneda("EUR", { usd: 18, eur: 22 })).toBe(22);
    expect(fallbackDeMoneda("MXN", { usd: 18 })).toBeNull();
  });
});

describe("mes de negocio (America/Mexico_City)", () => {
  it("23:30 del 31/08 en México sigue siendo agosto", () => {
    const hoy = new Date("2026-08-31T23:30:00-06:00");
    expect(ventanaDireccionDesdeIso(hoy)).toBe("2026-03-01");
  });

  it("00:30 del 01/09 en México ya es septiembre", () => {
    const hoy = new Date("2026-09-01T00:30:00-06:00");
    expect(ventanaDireccionDesdeIso(hoy)).toBe("2026-04-01");
  });

  it("aritmética mensual pura cruza el año", () => {
    expect(mesMasOffset("2026-01", -1)).toBe("2025-12");
    expect(mesMasOffset("2026-01", -5)).toBe("2025-08");
    expect(mesMasOffset("2025-12", 1)).toBe("2026-01");
    expect(mesMasOffset("2026-06", 0)).toBe("2026-06");
  });

  it("la ventana es date-only y no depende de la TZ del runner", () => {
    const instante = new Date("2026-09-01T05:00:00Z"); // 23:00 del 31/08 en CDMX
    expect(ventanaDireccionDesdeIso(instante)).toBe("2026-03-01");
  });
});
