import { describe, expect, it } from "vitest";
import {
  contarSignificativos,
  formatMoneyDisplay,
  normalizeMoneyText,
  parseMoneyText,
  posicionCursor,
  sanitizeMoneyText,
  valorANumeroTexto,
} from "../moneyInputFormat";

describe("sanitizeMoneyText", () => {
  it("descarta caracteres no numéricos", () => {
    expect(sanitizeMoneyText("abc12x3")).toBe("123");
  });

  it("ignora separadores de miles cuando ya hay punto decimal", () => {
    expect(sanitizeMoneyText("1,234.56")).toBe("1234.56");
  });

  it("acepta coma como decimal", () => {
    expect(sanitizeMoneyText("1234,5")).toBe("1234.5");
    expect(sanitizeMoneyText("1234,")).toBe("1234.");
  });

  it("trata la coma como miles cuando le siguen más de 2 dígitos", () => {
    expect(sanitizeMoneyText("1,234")).toBe("1234");
  });

  it("recorta a 2 decimales", () => {
    expect(sanitizeMoneyText("10.9999")).toBe("10.99");
  });

  it("sólo permite negativo cuando se habilita", () => {
    expect(sanitizeMoneyText("-50")).toBe("50");
    expect(sanitizeMoneyText("-50", true)).toBe("-50");
  });
});

describe("formatMoneyDisplay", () => {
  it("agrupa miles y conserva lo tecleado", () => {
    expect(formatMoneyDisplay("1234567.5")).toBe("1,234,567.5");
    expect(formatMoneyDisplay("1234.")).toBe("1,234.");
    expect(formatMoneyDisplay("")).toBe("");
  });

  it("normaliza ceros a la izquierda", () => {
    expect(formatMoneyDisplay("0123")).toBe("123");
  });

  it("soporta negativos", () => {
    expect(formatMoneyDisplay("-1234.5")).toBe("-1,234.5");
  });
});

describe("parseMoneyText / normalizeMoneyText", () => {
  it("devuelve null cuando está vacío o incompleto", () => {
    expect(parseMoneyText("")).toBeNull();
    expect(parseMoneyText(".")).toBeNull();
  });

  it("normaliza a 2 decimales con miles", () => {
    expect(normalizeMoneyText("1234.5")).toBe("1,234.50");
    expect(normalizeMoneyText("")).toBe("");
  });
});

describe("cursor", () => {
  it("cuenta sólo dígitos y punto", () => {
    expect(contarSignificativos("1,234.5", 5)).toBe(4);
  });

  it("ubica el cursor tras N caracteres significativos", () => {
    expect(posicionCursor("1,234.5", 4)).toBe(5);
    expect(posicionCursor("1,234.5", 0)).toBe(0);
  });
});

describe("valorANumeroTexto", () => {
  it("muestra vacío para 0, null y undefined (sin '0' pegajoso)", () => {
    expect(valorANumeroTexto(0)).toBe("");
    expect(valorANumeroTexto(null)).toBe("");
    expect(valorANumeroTexto(undefined)).toBe("");
  });

  it("formatea valores existentes", () => {
    expect(valorANumeroTexto(1234.5)).toBe("1,234.5");
  });
});
