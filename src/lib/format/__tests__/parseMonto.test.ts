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

  it("mantiene el punto decimal aunque tenga exactamente tres dígitos", () => {
    expect(parseMonto("50.000")).toBe(50);
    expect(parseMonto("1.234")).toBe(1.234);
    expect(parseMonto("1234.567")).toBe(1234.567);
  });

  it("EC-06: conserva el punto decimal en los demás casos", () => {
    expect(parseMonto("50.00")).toBe(50);
    expect(parseMonto("1.2345")).toBe(1.2345);
  });

  it("EC-06: con coma presente el punto NO es separador de miles", () => {
    expect(parseMonto("1,234.567")).toBe(1234.567);
  });

  it("mantiene la precisión de tasas y cantidades sin exigir opciones especiales", () => {
    expect(parseMonto("18.455", NaN)).toBe(18.455);
    expect(parseMonto("0.000001", NaN)).toBe(0.000001);
    expect(parseMonto("18.455", NaN, { puntoDeMiles: false })).toBe(18.455);
  });

  it("permite punto de miles únicamente con un contrato explícito del origen", () => {
    expect(parseMonto("50.000", NaN, { puntoDeMiles: true })).toBe(50000);
    expect(parseMonto("1.234", NaN, { puntoDeMiles: true })).toBe(1234);
    expect(parseMonto("1.234", NaN, { puntoDeMiles: false })).toBe(1.234);
    expect(parseMonto("1,234.567", NaN, { puntoDeMiles: true })).toBe(1234.567);
  });

  it("sólo interpreta comas como miles si forman grupos completos", () => {
    expect(parseMonto("1,234,567")).toBe(1234567);
    expect(parseMonto("1234,567")).toBe(1234.567);
    expect(parseMonto("-1234,567")).toBe(-1234.567);
  });

  it("degrada a fallback cuando el texto no es interpretable", () => {
    expect(parseMonto("")).toBe(0);
    expect(parseMonto("abc")).toBe(0);
    expect(parseMonto("1.2.3")).toBe(0);
    expect(parseMonto("", 5)).toBe(5);
  });
});

/**
 * Ambos parsers conservan la magnitud del importe. `parseMonto` mantiene la
 * precisión de tasas/cantidades; MoneyInput limita la captura a dos decimales.
 */
describe("parseMonto ↔ MoneyInput (magnitud y precisión)", () => {
  const CASOS: Array<[string, number, number]> = [
    ["50.000", 50, 50],
    ["1.234", 1.234, 1.23],
    ["1234.567", 1234.567, 1234.56],
    ["1,234.567", 1234.567, 1234.56],
    ["1234,567", 1234.567, 1234.56],
    ["18.455", 18.455, 18.45],
    ["0.000001", 0.000001, 0],
    ["50.00", 50, 50],
    ["1,200.50", 1200.5, 1200.5],
    ["15,000", 15000, 15000],
    ["1,234,567", 1234567, 1234567],
    ["19,55", 19.55, 19.55],
    ["1234,5", 1234.5, 1234.5],
  ];

  it.each(CASOS)("%j conserva precisión genérica %j y limita dinero a %j", (texto, generico, dinero) => {
    expect(parseMonto(texto)).toBe(generico);
    expect(Number(sanitizeMoneyText(texto))).toBe(dinero);
  });
});
