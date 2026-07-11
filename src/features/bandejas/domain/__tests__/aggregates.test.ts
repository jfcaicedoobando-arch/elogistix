import { describe, it, expect } from "vitest";
import {
  resumirCartera,
  resumirCxpPorPagar,
  resumirCxpPorCapturar,
  variantDiasParaVencer,
  matchesUrgencia,
} from "../aggregates";

describe("bandejas/domain/aggregates", () => {
  it("resumirCartera separa saldos por moneda nativa y cuenta vencidas", () => {
    const r = resumirCartera([
      // @ts-expect-error fixture parcial
      { saldo: 100, moneda: "MXN", dias_vencido: 0 },
      // @ts-expect-error fixture parcial
      { saldo: 200, moneda: "USD", dias_vencido: 5 },
      // @ts-expect-error fixture parcial - saldo string + vencida
      { saldo: "50", moneda: "MXN", dias_vencido: 10 },
      // @ts-expect-error fixture parcial - moneda ajena
      { saldo: 30, moneda: "EUR", dias_vencido: 2 },
    ]);
    expect(r.total).toBe(4);
    expect(r.saldosNativos).toEqual({ MXN: 150, USD: 200, otras: { EUR: 30 } });
    expect(r.vencidasCount).toBe(3);
    expect(r.vencidoNativo).toEqual({ MXN: 50, USD: 200, otras: { EUR: 30 } });
    // Legacy mirrors (compat crudo)
    expect(r.totalSaldo).toBe(380);
    expect(r.vencidoSaldo).toBe(280);
    expect(r.vencidas).toBe(3);
  });

  it("resumirCxpPorPagar homologa a MXN usando TC y reporta faltantes", () => {
    const r = resumirCxpPorPagar([
      // @ts-expect-error fixture parcial - MXN
      { saldo: 100, moneda: "MXN", dias_para_vencer: 3, tipo_cambio_usd: null },
      // @ts-expect-error fixture parcial - USD vencida con TC
      { saldo: 200, moneda: "USD", dias_para_vencer: -1, tipo_cambio_usd: 20 },
      // @ts-expect-error fixture parcial - USD sin TC
      { saldo: 50, moneda: "USD", dias_para_vencer: null, tipo_cambio_usd: null },
      // @ts-expect-error fixture parcial - EUR (sin TC siempre)
      { saldo: 30, moneda: "EUR", dias_para_vencer: 5, tipo_cambio_usd: null },
    ]);
    expect(r.total).toBe(4);
    expect(r.vencidas).toBe(1);
    expect(r.saldoMXN).toBe(100 + 200 * 20); // 4100
    expect(r.porMoneda).toEqual({ MXN: 100, USD: 250, EUR: 30 });
    expect(r.faltaTipoCambio).toBe(2); // 1 USD sin TC + 1 EUR
  });

  it("variantDiasParaVencer mapea rangos", () => {
    expect(variantDiasParaVencer(-1)).toBe("destructive");
    expect(variantDiasParaVencer(0)).toBe("secondary");
    expect(variantDiasParaVencer(7)).toBe("secondary");
    expect(variantDiasParaVencer(8)).toBe("outline");
  });

  it("resumirCxpPorCapturar separa presupuesto por moneda", () => {
    const r = resumirCxpPorCapturar([
      // @ts-expect-error fixture parcial
      { presupuestado_mxn: 1000, presupuestado_usd: 0, facturas_capturadas: 2 },
      // @ts-expect-error fixture parcial
      { presupuestado_mxn: "500", presupuestado_usd: 200, facturas_capturadas: 0 },
    ]);
    expect(r).toEqual({
      total: 2,
      totalPresupuestadoMxn: 1500,
      totalPresupuestadoUsd: 200,
      facturasCapturadas: 2,
    });
  });
});
