import { describe, it, expect } from "vitest";
import { formatDate } from "@/lib/formatters/dates";
import { enUS } from "date-fns/locale";

describe("formatters/dates · formatDate", () => {
  it("01 · formatea fecha ISO al formato por defecto dd/MM/yyyy", () => {
    expect(formatDate("2024-03-15")).toBe("15/03/2024");
  });

  it("02 · formatea con formato personalizado yyyy-MM-dd", () => {
    expect(formatDate("2024-03-15", "yyyy-MM-dd")).toBe("2024-03-15");
  });

  it("03 · formatea con locale en-US y formato MMMM d, yyyy", () => {
    expect(formatDate("2024-03-15", "MMMM d, yyyy", { locale: enUS })).toBe("March 15, 2024");
  });

  it("04 · nombre del mes en español (locale es por defecto)", () => {
    const result = formatDate("2024-03-15", "MMMM");
    expect(result.toLowerCase()).toContain("marzo");
  });

  it("05 · string vacío devuelve guión", () => {
    expect(formatDate("")).toBe("-");
  });

  it("06 · string inválido devuelve el string original", () => {
    expect(formatDate("no-es-una-fecha")).toBe("no-es-una-fecha");
  });

  it("07 · fecha en primero de enero", () => {
    expect(formatDate("2024-01-01")).toBe("01/01/2024");
  });

  it("08 · fecha en último día del año", () => {
    expect(formatDate("2024-12-31")).toBe("31/12/2024");
  });

  it("09 · formato solo de hora HH:mm con fecha ISO que incluye tiempo", () => {
    expect(formatDate("2024-06-20T14:30:00", "HH:mm")).toBe("14:30");
  });

  it("10 · formato dd-MMM-yy produce abreviatura de mes", () => {
    const result = formatDate("2024-03-15", "dd-MMM-yy");
    expect(result).toMatch(/15-\w{3}-24/);
  });

  it("11 · año bisiesto 29 de febrero se formatea correctamente", () => {
    expect(formatDate("2024-02-29")).toBe("29/02/2024");
  });

  it("12 · formato d 'de' MMMM 'de' yyyy en español", () => {
    const result = formatDate("2024-03-15", "d 'de' MMMM 'de' yyyy");
    expect(result).toBe("15 de marzo de 2024");
  });
});
