import { describe, it, expect } from "vitest";
import { calcularAlertasPnl, PNL_UMBRAL_SOBRECOSTO_PCT, PNL_UMBRAL_MARGEN_MIN_PCT } from "../pnlAlertas";

describe("calcularAlertasPnl", () => {
  it("sobrecosto exactamente en el umbral (10%) NO alerta (comparación estricta >)", () => {
    const r = calcularAlertasPnl({
      ventaReal: 1000, costoReal: 500, ventaPresup: 1000, costoPresup: 100,
      deltaCostoPct: PNL_UMBRAL_SOBRECOSTO_PCT,
    });
    expect(r.alertaSobrecosto).toBe(false);
  });

  it("sobrecosto por encima del umbral SÍ alerta", () => {
    const r = calcularAlertasPnl({
      ventaReal: 1000, costoReal: 500, ventaPresup: 1000, costoPresup: 100,
      deltaCostoPct: PNL_UMBRAL_SOBRECOSTO_PCT + 0.01,
    });
    expect(r.alertaSobrecosto).toBe(true);
  });

  it("margen exactamente en el umbral (15%) NO alerta (comparación estricta <)", () => {
    const r = calcularAlertasPnl({
      ventaReal: 100, costoReal: 85, ventaPresup: 0, costoPresup: 0, deltaCostoPct: 0,
    });
    expect(r.margenReal).toBeCloseTo(PNL_UMBRAL_MARGEN_MIN_PCT, 5);
    expect(r.alertaMargen).toBe(false);
  });

  it("venta real 0 → sin alerta de margen", () => {
    const r = calcularAlertasPnl({
      ventaReal: 0, costoReal: 0, ventaPresup: 0, costoPresup: 0, deltaCostoPct: 0,
    });
    expect(r.alertaMargen).toBe(false);
    expect(r.margenReal).toBe(0);
  });
});
