import { describe, it, expect } from "vitest";
import { formatSubexpediente } from "../subexpediente";

describe("formatSubexpediente (v13.66.14)", () => {
  it("aplica padding de 2 dígitos al orden", () => {
    expect(formatSubexpediente("ELIMP00272", 1)).toBe("ELIMP00272-01");
    expect(formatSubexpediente("ELIMP00272", 6)).toBe("ELIMP00272-06");
    expect(formatSubexpediente("ELIMP00272", 12)).toBe("ELIMP00272-12");
  });

  it("normaliza orden nulo/0/negativo a 1", () => {
    expect(formatSubexpediente("ELIMP00272", null)).toBe("ELIMP00272-01");
    expect(formatSubexpediente("ELIMP00272", 0)).toBe("ELIMP00272-01");
    expect(formatSubexpediente("ELIMP00272", -5)).toBe("ELIMP00272-01");
    expect(formatSubexpediente("ELIMP00272", undefined)).toBe("ELIMP00272-01");
  });

  it("trunca decimales del orden", () => {
    expect(formatSubexpediente("ELIMP00272", 3.7)).toBe("ELIMP00272-03");
  });

  it("regresa sólo el sufijo cuando el expediente está vacío (sin guión huérfano)", () => {
    expect(formatSubexpediente("", 4)).toBe("04");
    expect(formatSubexpediente(null, 2)).toBe("02");
    expect(formatSubexpediente(undefined, 1)).toBe("01");
    expect(formatSubexpediente("   ", 3)).toBe("03");
  });
});
