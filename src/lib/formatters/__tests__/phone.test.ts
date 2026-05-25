import { describe, it, expect } from "vitest";
import { formatPhoneMx } from "@/lib/formatters/phone";

describe("formatPhoneMx", () => {
  it("vacío/null → ''", () => {
    expect(formatPhoneMx("")).toBe("");
    expect(formatPhoneMx(null)).toBe("");
    expect(formatPhoneMx(undefined)).toBe("");
  });

  it("CDMX 10 dígitos → (55) NNNN-NNNN", () => {
    expect(formatPhoneMx("5512345678")).toBe("(55) 1234-5678");
  });

  it("Querétaro lada 3 dígitos", () => {
    expect(formatPhoneMx("4422170696")).toBe("(442) 217-0696");
  });

  it("con prefijo + agrega +52", () => {
    expect(formatPhoneMx("+5215512345678")).toContain("+52");
  });

  it("inválido → devuelve original sin destruir", () => {
    expect(formatPhoneMx("abc")).toBe("abc");
    expect(formatPhoneMx("123")).toBe("123");
  });
});
