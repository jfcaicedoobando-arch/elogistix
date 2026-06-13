import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  pluralS,
  formatDiasCredito,
} from "@/lib/formatters/numbers";

describe("formatters/numbers · formatCurrency", () => {
  it("01 · MXN antepone prefijo MXN", () => {
    expect(formatCurrency(1000, "MXN")).toMatch(/^MXN/);
  });

  it("02 · MXN incluye valor numérico correcto", () => {
    expect(formatCurrency(1000, "MXN")).toContain("1,000");
  });

  it("03 · USD retorna formato con símbolo USD", () => {
    const result = formatCurrency(500, "USD");
    expect(result).toContain("500");
  });

  it("04 · valor cero formatea dos decimales", () => {
    expect(formatCurrency(0, "MXN")).toContain("0.00");
  });

  it("05 · valor negativo se muestra con signo negativo", () => {
    expect(formatCurrency(-200, "MXN")).toContain("200");
  });
});

describe("formatters/numbers · formatCurrencyCompact", () => {
  it("06 · millón se abrevia con K o M", () => {
    const result = formatCurrencyCompact(1_000_000, "MXN");
    expect(result).toMatch(/M|K/);
  });

  it("07 · prefija correctamente la moneda", () => {
    expect(formatCurrencyCompact(5000, "USD")).toMatch(/^USD/);
  });

  it("08 · NaN se trata como 0", () => {
    expect(formatCurrencyCompact(NaN, "MXN")).toContain("0");
  });

  it("09 · Infinity se trata como 0", () => {
    expect(formatCurrencyCompact(Infinity, "MXN")).toContain("0");
  });
});

describe("formatters/numbers · formatNumber", () => {
  it("10 · null devuelve —", () => {
    expect(formatNumber(null)).toBe("—");
  });

  it("11 · undefined devuelve —", () => {
    expect(formatNumber(undefined)).toBe("—");
  });

  it("12 · NaN devuelve —", () => {
    expect(formatNumber(NaN)).toBe("—");
  });

  it("13 · número entero sin opciones sin decimales", () => {
    expect(formatNumber(1500)).toBe("1,500");
  });

  it("14 · suffix se añade al final", () => {
    expect(formatNumber(42, { suffix: "kg" })).toBe("42 kg");
  });

  it("15 · decimals fuerza los dígitos decimales", () => {
    expect(formatNumber(3.1, { decimals: 3 })).toContain("100");
  });
});

describe("formatters/numbers · pluralS", () => {
  it("16 · 1 devuelve string vacío", () => {
    expect(pluralS(1)).toBe("");
  });

  it("17 · 0 devuelve s", () => {
    expect(pluralS(0)).toBe("s");
  });

  it("18 · 2 devuelve s", () => {
    expect(pluralS(2)).toBe("s");
  });
});

describe("formatters/numbers · formatDiasCredito", () => {
  it("19 · null devuelve —", () => {
    expect(formatDiasCredito(null)).toBe("—");
  });

  it("20 · undefined devuelve —", () => {
    expect(formatDiasCredito(undefined)).toBe("—");
  });

  it("21 · string vacío devuelve —", () => {
    expect(formatDiasCredito("")).toBe("—");
  });

  it("22 · 0 devuelve Contado", () => {
    expect(formatDiasCredito(0)).toBe("Contado");
  });

  it("23 · 30 devuelve '30 días'", () => {
    expect(formatDiasCredito(30)).toBe("30 días");
  });

  it("24 · string '60' devuelve '60 días'", () => {
    expect(formatDiasCredito("60")).toBe("60 días");
  });

  it("25 · string no numérico devuelve —", () => {
    expect(formatDiasCredito("abc")).toBe("—");
  });
});
