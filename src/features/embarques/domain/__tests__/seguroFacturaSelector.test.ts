import { describe, expect, it } from "vitest";
import { normalizarPrimaSeguro } from "../seguroFacturaSelector";

describe("selector premium numeric(14,2) normalization", () => {
  it.each([
    [100, "100.00"], ["100.005", "100.01"], ["100.004999999999999999999", "100.00"],
    ["1.005", "1.01"], ["-0.004", "0.00"], ["0", "0.00"], ["1e2", "100.00"],
    ["999999999999.994", "999999999999.99"],
  ])("normalizes %s to %s without binary rounding", (input, expected) => {
    expect(normalizarPrimaSeguro(input)).toBe(expected);
  });
  it.each([NaN, Infinity, -Infinity, "NaN", "Infinity", "", "0xff", "-0.005", "999999999999.995", "1e400", "invalid"])("rejects invalid or unrepresentable %s", (input) => {
    expect(normalizarPrimaSeguro(input)).toBeNull();
  });
});
