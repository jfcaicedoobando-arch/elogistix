import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate } from "@/lib/formatters";

describe("formatCurrency", () => {
  it("formatea MXN por defecto", () => {
    const result = formatCurrency(1234.5);
    expect(result).toContain("1,234.50");
  });
  it("formatea USD", () => {
    const result = formatCurrency(99.99, "USD");
    expect(result).toContain("99.99");
  });
  it("formatea EUR", () => {
    const result = formatCurrency(500, "EUR");
    expect(result).toContain("500.00");
  });
  it("maneja cero", () => {
    expect(formatCurrency(0)).toContain("0.00");
  });
  it("maneja negativos", () => {
    const result = formatCurrency(-100);
    expect(result).toContain("100.00");
  });
});

describe("formatDate", () => {
  it("devuelve '-' para cadena vacía", () => {
    expect(formatDate("")).toBe("-");
  });
  it("formatea fecha ISO correctamente", () => {
    expect(formatDate("2026-03-01")).toBe("01/03/2026");
  });
  it("parsea cadena parcial (YYYY-MM) como primer día del mes", () => {
    expect(formatDate("2026-03")).toBe("01/03/2026");
  });
});
