import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  pluralS,
  formatDiasCredito,
} from "../numbers";

describe("formatters/numbers", () => {
  it("numbers.formatCurrency: MXN siempre lleva prefijo 'MXN '", () => {
    expect(formatCurrency(1000)).toMatch(/^MXN /);
  });

  it("numbers.formatCurrency: USD no se prefijea como MXN", () => {
    expect(formatCurrency(1000, "USD")).not.toMatch(/^MXN /);
  });

  it("numbers.formatCurrencyCompact: usa notación compacta", () => {
    const r = formatCurrencyCompact(1_500_000, "USD");
    expect(r).toContain("USD");
    expect(r).toMatch(/M|K/);
  });

  it("numbers.formatCurrencyCompact: NaN se trata como 0", () => {
    const r = formatCurrencyCompact(Number.NaN);
    expect(r).toContain("0");
  });

  it("numbers.formatNumber: null/undefined → '—'", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
  });

  it("numbers.formatNumber: NaN → '—'", () => {
    expect(formatNumber(Number.NaN)).toBe("—");
  });

  it("numbers.formatNumber: entero sin decimales por defecto", () => {
    expect(formatNumber(1234)).toBe("1,234");
  });

  it("numbers.formatNumber: respeta decimals option", () => {
    expect(formatNumber(3.14159, { decimals: 2 })).toBe("3.14");
  });

  it("numbers.formatNumber: agrega sufijo", () => {
    expect(formatNumber(5, { suffix: "kg" })).toBe("5 kg");
  });

  it("numbers.pluralS: 1 → '', otros → 's'", () => {
    expect(pluralS(1)).toBe("");
    expect(pluralS(0)).toBe("s");
    expect(pluralS(2)).toBe("s");
  });

  it("numbers.formatDiasCredito: nullish/empty → '—'", () => {
    expect(formatDiasCredito(null)).toBe("—");
    expect(formatDiasCredito(undefined)).toBe("—");
    expect(formatDiasCredito("")).toBe("—");
    expect(formatDiasCredito("abc")).toBe("—");
  });

  it("numbers.formatDiasCredito: 0 → 'Contado'", () => {
    expect(formatDiasCredito(0)).toBe("Contado");
    expect(formatDiasCredito("0")).toBe("Contado");
  });

  it("numbers.formatDiasCredito: N → 'N días'", () => {
    expect(formatDiasCredito(30)).toBe("30 días");
    expect(formatDiasCredito("15")).toBe("15 días");
  });
});
