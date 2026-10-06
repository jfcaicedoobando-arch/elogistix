import currency from "currency.js";
import vectors from "../../../../tests/contracts/money.json";
import { describe, expect, it } from "vitest";
import { roundMoney, sumarMontos, calcularIVA, calcularTotalConIVA, calcularUtilidad, subtotalLinea } from "../financialUtils";

describe("canonical monetary contract (Postgres numeric ROUND_HALF_UP)", () => {
  it.each(vectors.map(({ input, rounded }) => [input, rounded]))("rounds and accumulates %s to %s", (input, expected) => {
    expect(roundMoney(input)).toBe(expected);
    expect(sumarMontos([input])).toBe(expected);
    expect(calcularUtilidad(input, 0)).toBe(expected);
  });
  it("rounds each already-calculated amount, preserving cancellation", () => {
    expect(sumarMontos([1.005, -1.005, 10.075, -10.075])).toBe(0);
    expect(sumarMontos([0.005, 0.005])).toBe(0.02);
    expect(subtotalLinea(3, 0.125)).toBe(0.38);
  });
  it.each([0, 0.08, 0.16])("preserves sign symmetry for tax rate %s", (tasa) => {
    expect(calcularIVA(-10.075, tasa)).toBe(-calcularIVA(10.075, tasa));
    expect(calcularTotalConIVA(-10.075, tasa)).toBe(-calcularTotalConIVA(10.075, tasa));
  });
  it("retains each helper’s legacy invalid-input behavior, with wire schemas rejecting invalid values", () => {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      expect(roundMoney(invalid)).toBe(0);
      expect(sumarMontos([invalid])).toBe(currency(0).add(currency(invalid)).value);
    }
    expect(sumarMontos([])).toBe(0);
  });
});
