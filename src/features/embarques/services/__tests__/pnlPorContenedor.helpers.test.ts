import { describe, it, expect } from "vitest";
import {
  round2,
  calcMargen,
  repartirFlat,
  isActivo,
} from "../pnlPorContenedor.helpers";

describe("pnlPorContenedor.helpers", () => {
  describe("round2", () => {
    it("redondea a 2 decimales", () => {
      expect(round2(1.234)).toBe(1.23);
      expect(round2(1.235)).toBe(1.24);
    });
    it("mantiene enteros", () => {
      expect(round2(10)).toBe(10);
    });
    it("maneja negativos (round2)", () => {
      expect(round2(-1.234)).toBe(-1.23);
    });
  });

  describe("calcMargen", () => {
    it("calcula porcentaje", () => {
      expect(calcMargen(20, 100)).toBe(20);
    });
    it("retorna 0 cuando venta <= 0", () => {
      expect(calcMargen(50, 0)).toBe(0);
      expect(calcMargen(50, -10)).toBe(0);
    });
  });

  describe("repartirFlat", () => {
    it("reparte exacto entre 4", () => {
      const p = repartirFlat(100, 4);
      expect(p).toEqual([25, 25, 25, 25]);
      expect(p.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it("residuo va al último", () => {
      const p = repartirFlat(100, 3);
      expect(p[0]).toBe(33.33);
      expect(p[1]).toBe(33.33);
      // suma cuadra al centavo
      expect(round2(p.reduce((a, b) => a + b, 0))).toBe(100);
    });

    it("retorna [] cuando n<=0", () => {
      expect(repartirFlat(100, 0)).toEqual([]);
      expect(repartirFlat(100, -5)).toEqual([]);
    });

    it("n=1 devuelve el total", () => {
      expect(repartirFlat(77.77, 1)).toEqual([77.77]);
    });
  });

  describe("isActivo", () => {
    it("true cuando deleted_at es null/undefined", () => {
      expect(isActivo({ deleted_at: null })).toBe(true);
      expect(isActivo({})).toBe(true);
    });
    it("false cuando existe deleted_at", () => {
      expect(isActivo({ deleted_at: "2025-01-01" })).toBe(false);
    });
  });
});
