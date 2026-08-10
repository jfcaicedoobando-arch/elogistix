import { describe, it, expect } from "vitest";
import { round2 } from "../pagoProveedorLote";
import { roundMoney } from "@/lib/financial/financialUtils";

describe("Ola 9 · B3 — round2 delega en roundMoney", () => {
  it.each([1.005, 2.675, 1234.5649, 0.1 + 0.2])("coincide con roundMoney(%s)", (n) => {
    expect(round2(n)).toBe(roundMoney(n));
  });

  it("devuelve 0 con valores no finitos", () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
