import { describe, it, expect } from "vitest";
import {
  resumirCartera,
  resumirCxpPorPagar,
  resumirCxpPorCapturar,
  resumirFacturacionPorEmitir,
  variantDiasParaVencer,
  DIAS_ATRASO_FACTURACION,
} from "../aggregates";

describe("bandejas/domain/aggregates", () => {
  it("resumirCartera agrega saldos y separa vencidas", () => {
    const r = resumirCartera([
      // @ts-expect-error fixture parcial
      { saldo: 100, dias_vencido: 0 },
      // @ts-expect-error fixture parcial
      { saldo: 200, dias_vencido: 5 },
      // @ts-expect-error fixture parcial
      { saldo: "50", dias_vencido: 10 },
    ]);
    expect(r).toEqual({ total: 3, totalSaldo: 350, vencidas: 2, vencidoSaldo: 250 });
  });

  it("resumirCxpPorPagar cuenta vencidas (dias_para_vencer<0)", () => {
    const r = resumirCxpPorPagar([
      // @ts-expect-error fixture parcial
      { saldo: 100, dias_para_vencer: 3 },
      // @ts-expect-error fixture parcial
      { saldo: 200, dias_para_vencer: -1 },
      // @ts-expect-error fixture parcial
      { saldo: 50, dias_para_vencer: null },
    ]);
    expect(r).toEqual({ total: 3, totalSaldo: 350, vencidas: 1 });
  });

  it("variantDiasParaVencer mapea rangos", () => {
    expect(variantDiasParaVencer(-1)).toBe("destructive");
    expect(variantDiasParaVencer(0)).toBe("secondary");
    expect(variantDiasParaVencer(7)).toBe("secondary");
    expect(variantDiasParaVencer(8)).toBe("outline");
  });

  it("resumirCxpPorCapturar suma presupuesto y facturas", () => {
    const r = resumirCxpPorCapturar([
      // @ts-expect-error fixture parcial
      { costos_presupuestados: 1000, facturas_capturadas: 2 },
      // @ts-expect-error fixture parcial
      { costos_presupuestados: "500", facturas_capturadas: 0 },
    ]);
    expect(r).toEqual({ total: 2, totalPresupuestado: 1500, facturasCapturadas: 2 });
  });

  it("resumirFacturacionPorEmitir usa umbral DIAS_ATRASO_FACTURACION", () => {
    const r = resumirFacturacionPorEmitir([
      // @ts-expect-error fixture parcial
      { total: 100, dias_desde_emision: 3 },
      // @ts-expect-error fixture parcial
      { total: 200, dias_desde_emision: DIAS_ATRASO_FACTURACION + 1 },
    ]);
    expect(r).toEqual({ total: 2, totalPorFacturar: 300, atrasadas: 1 });
  });
});
