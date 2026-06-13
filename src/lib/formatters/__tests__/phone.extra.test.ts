import { describe, it, expect } from "vitest";
import { formatPhoneMx } from "@/lib/formatters/phone";

describe("formatters/phone · formatPhoneMx", () => {
  it("01 · null devuelve string vacío", () => {
    expect(formatPhoneMx(null)).toBe("");
  });

  it("02 · undefined devuelve string vacío", () => {
    expect(formatPhoneMx(undefined)).toBe("");
  });

  it("03 · string vacío devuelve string vacío", () => {
    expect(formatPhoneMx("")).toBe("");
  });

  it("04 · número CDMX (55) se formatea con lada de 2 dígitos", () => {
    const result = formatPhoneMx("5512345678");
    expect(result).toBe("(55) 1234-5678");
  });

  it("05 · número Querétaro (442) se formatea con lada de 3 dígitos", () => {
    const result = formatPhoneMx("4422170696");
    expect(result).toMatch(/\(442\)/);
  });

  it("06 · número con prefijo +52 incluye +52 en la salida", () => {
    const result = formatPhoneMx("+5215512345678");
    expect(result).toMatch(/^\+52/);
  });

  it("07 · número +52 retorna valor con prefijo internacional", () => {
    const result = formatPhoneMx("+5215512345678");
    expect(result).toMatch(/^\+52/);
  });

  it("08 · número completamente inválido devuelve el original", () => {
    const invalid = "000";
    expect(formatPhoneMx(invalid)).toBe(invalid);
  });

  it("09 · número con letras no válidas devuelve el original", () => {
    const invalid = "abc-def-ghij";
    expect(formatPhoneMx(invalid)).toBe(invalid);
  });

  it("10 · número Guadalajara (33) se formatea con lada de 2 dígitos", () => {
    const result = formatPhoneMx("3312345678");
    expect(result).toMatch(/\(33\)/);
  });

  it("11 · número Monterrey (81) se formatea con lada de 2 dígitos", () => {
    const result = formatPhoneMx("8112345678");
    expect(result).toMatch(/\(81\)/);
  });

  it("12 · resultado usa guión para separar secciones del número local", () => {
    const result = formatPhoneMx("5512345678");
    expect(result).toContain("-");
  });
});
