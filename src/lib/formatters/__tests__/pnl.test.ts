import { describe, it, expect } from "vitest";
import { fmtPnl, pctPnl, deltaPnl, centavosPnl } from "../pnl";

describe("lib/formatters/pnl", () => {
  describe("fmtPnl", () => {
    it("formatea positivos en MXN", () => {
      expect(fmtPnl(1500)).toMatch(/1[,.]500/);
      expect(fmtPnl(1500)).toMatch(/MXN|\$/);
    });
    it("trata null/undefined como 0", () => {
      expect(fmtPnl(null as unknown as number)).toMatch(/0/);
      expect(fmtPnl(undefined as unknown as number)).toMatch(/0/);
    });
    it("respeta negativos en fmtPnl", () => {
      expect(fmtPnl(-250)).toMatch(/250/);
    });
  });

  describe("pctPnl", () => {
    it("formatea con 1 decimal y símbolo %", () => {
      expect(pctPnl(12.345)).toBe("12.3%");
      expect(pctPnl(0)).toBe("0.0%");
      expect(pctPnl(-7.5)).toBe("-7.5%");
    });
    it("trata null/undefined como 0", () => {
      expect(pctPnl(null as unknown as number)).toBe("0.0%");
      expect(pctPnl(undefined as unknown as number)).toBe("0.0%");
    });
  });

  describe("deltaPnl", () => {
    it("calcula diferencia absoluta y porcentual", () => {
      expect(deltaPnl(120, 100)).toEqual({ abs: 20, pct: 20 });
      expect(deltaPnl(80, 100)).toEqual({ abs: -20, pct: -20 });
    });
    it("devuelve pct=0 cuando el presupuesto es 0 o negativo", () => {
      expect(deltaPnl(50, 0)).toEqual({ abs: 50, pct: 0 });
      expect(deltaPnl(50, -10)).toEqual({ abs: 60, pct: 0 });
    });
    it("trata null como 0 en ambos parámetros", () => {
      expect(deltaPnl(null as unknown as number, null as unknown as number)).toEqual({
        abs: 0,
        pct: 0,
      });
    });
  });

  // P2-7: Costos mostraba 8,500.62 y Utilidad/dashboard 8,500.63 porque uno
  // restaba valores crudos de 4 decimales y el otro ya redondeados.
  describe("centavosPnl", () => {
    it("la utilidad mostrada es la resta de la venta y el costo mostrados", () => {
      const venta = centavosPnl(61638.1538);
      const costo = centavosPnl(53137.525);
      expect(venta).toBe(61638.15);
      expect(costo).toBe(53137.53);
      expect(centavosPnl(venta - costo)).toBe(8500.62);
      // La resta cruda daba el medio centavo de más.
      expect(centavosPnl(61638.1538 - 53137.525)).toBe(8500.63);
    });
    it("trata null/undefined como 0", () => {
      expect(centavosPnl(null as unknown as number)).toBe(0);
      expect(centavosPnl(undefined as unknown as number)).toBe(0);
    });
  });
});
