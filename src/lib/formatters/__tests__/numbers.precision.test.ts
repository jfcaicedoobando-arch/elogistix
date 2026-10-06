import { describe, expect, it } from "vitest";
import { formatCurrency, formatNumber } from "../numbers";

describe("canonical formatter precision without changing defaults", () => {
  it.each<[number, string]>([[-1.5, "USD -2"], [-0.5, "USD -1"], [1.5, "USD 2"]])(
    "rounds %s directly with Intl for integer currency", (value, expected) => {
      expect(formatCurrency(value, "USD", { decimals: 0 })).toBe(expected);
    },
  );

  it.each([1, 1.2, 1.234, 1.2345, -1.2345, 1234.5678])("preserves default Intl numeric precision for %s when requested", (value) => {
    expect(formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 3 }))
      .toBe(value.toLocaleString("es-MX"));
  });

  it("does not pad trailing zeroes unless the caller requests them", () => {
    expect(formatNumber(1.2, { minimumFractionDigits: 0, maximumFractionDigits: 3 })).toBe("1.2");
    expect(formatNumber(1, { minimumFractionDigits: 0, maximumFractionDigits: 3 })).toBe("1");
    expect(formatNumber(1.2, { decimals: 3 })).toBe("1.200");
    expect(formatNumber(1.2, { minimumFractionDigits: 3 })).toBe("1.200");
  });

  it("keeps default currency/number precision and separate cache entries", () => {
    expect(formatCurrency(-1.5, "USD")).toBe("USD -1.50");
    expect(formatCurrency(-1.5, "USD", { decimals: 0 })).toBe("USD -2");
    expect(formatCurrency(-1.5, "USD")).toBe("USD -1.50");
    expect(formatCurrency(1.2345, "KWD")).toContain("1.235");
    expect(formatCurrency(1.5)).toBe("MXN 1.50");
    expect(formatNumber(1.2345)).toBe("1.23");
    expect(formatNumber(12)).toBe("12");
    expect(formatNumber(1.2, { decimals: 2, suffix: "kg" })).toBe("1.20 kg");
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(NaN)).toBe("—");
  });
});
