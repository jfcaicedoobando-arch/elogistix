import { describe, it, expect } from "vitest";
import { roundMoney } from "../financialUtils";

describe("roundMoney — motor canónico de redondeo (M3)", () => {
  it("redondea a 2 decimales hacia arriba en .5 positivos", () => {
    expect(roundMoney(2.505)).toBe(2.51);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(0.125)).toBe(0.13);
  });

  it("usa half-away-from-zero en negativos (paridad con Postgres ROUND)", () => {
    expect(roundMoney(-2.505)).toBe(-2.51);
    expect(roundMoney(-1.005)).toBe(-1.01);
    expect(Math.round(-2.505 * 100) / 100).toBe(-2.5); // contraste: JS crudo diverge
  });

  it("es idempotente y respeta montos ya redondeados", () => {
    expect(roundMoney(100)).toBe(100);
    expect(roundMoney(roundMoney(33.333))).toBe(33.33);
    expect(roundMoney(-0)).toBe(0);
  });

  it("degrada valores no finitos a 0", () => {
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
