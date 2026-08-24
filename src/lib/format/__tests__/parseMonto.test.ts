import { describe, it, expect } from "vitest";
import { limpiarSeparadoresMiles, parseMonto } from "../parseMonto";
import { sanitizeMoneyText } from "@/components/shared/utils/moneyInputFormat";

describe("parseMonto (Ola 7 · B5)", () => {
  it("quita símbolos, espacios duros y separadores de miles", () => {
    expect(limpiarSeparadoresMiles("$ 1,200.50")).toBe("1200.50");
    expect(limpiarSeparadoresMiles("1\u00a0234,567")).toBe("1234567");
  });

  it("respeta la coma que NO es separador de miles", () => {
    expect(limpiarSeparadoresMiles("1,2")).toBe("1,2");
  });

  it("parsea montos con miles y decimales", () => {
    expect(parseMonto("1,200.50")).toBe(1200.5);
    expect(parseMonto("15,000")).toBe(15000);
  });

  it("EC-06: punto seguido de exactamente 3 dígitos es separador de miles", () => {
    expect(parseMonto("50.000")).toBe(50000);
    expect(parseMonto("1.234")).toBe(1234);
  });

  it("EC-06: conserva el punto decimal en los demás casos", () => {
    expect(parseMonto("50.00")).toBe(50);
    expect(parseMonto("1.2345")).toBe(1.2345);
  });

  it("EC-06: con coma presente el punto NO es separador de miles", () => {
    expect(parseMonto("1,234.567")).toBe(1234.567);
  });

  it("EC-06 opt-out: tasas con 3 decimales conservan su punto decimal", () => {
    expect(parseMonto("18.455", NaN, { puntoDeMiles: false })).toBe(18.455);
  });

  it("degrada a fallback cuando el texto no es interpretable", () => {
    expect(parseMonto("")).toBe(0);
    expect(parseMonto("abc")).toBe(0);
    expect(parseMonto("1.2.3")).toBe(0);
    expect(parseMonto("", 5)).toBe(5);
  });
});

/**
 * Tests cruzados (frontend_hunter P2): el mismo texto pegado debe valer lo
 * mismo en `parseMonto` (captura CxP/anticipos) y en `MoneyInput`
 * (`sanitizeMoneyText` + `Number`), el canon de captura de dinero es-MX.
 */
describe("parseMonto ≡ MoneyInput (canon EC-06)", () => {
  const CASOS: Array<[string, number]> = [
    ["50.000", 50000], // punto de miles pegado desde Excel/PDF
    ["1.234", 1234],
    ["50.00", 50],
    ["1,200.50", 1200.5],
    ["15,000", 15000],
    ["19,55", 19.55], // coma decimal (RG5)
    ["1234,5", 1234.5],
  ];

  it.each(CASOS)("parseMonto(%j) = %j", (texto, esperado) => {
    expect(parseMonto(texto)).toBe(esperado);
  });

  it.each(CASOS)("MoneyInput(%j) = %j", (texto, esperado) => {
    expect(Number(sanitizeMoneyText(texto))).toBe(esperado);
  });
});
