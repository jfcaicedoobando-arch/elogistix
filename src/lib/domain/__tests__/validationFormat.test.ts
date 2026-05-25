import { describe, it, expect } from "vitest";
import { formatValidationMessage } from "@/lib/domain/validationFormat";

describe("formatValidationMessage", () => {
  it("formatea Campo: razón.", () => {
    expect(formatValidationMessage("ETA", "campo obligatorio")).toBe("ETA: campo obligatorio.");
  });
  it("elimina puntuación final repetida", () => {
    expect(formatValidationMessage("ETA", "obligatorio.")).toBe("ETA: obligatorio.");
    expect(formatValidationMessage("ETA", "obligatorio!!!")).toBe("ETA: obligatorio.");
  });
  it("hace trim de espacios", () => {
    expect(formatValidationMessage("  Campo  ", "  razón  ")).toBe("Campo: razón.");
  });
});
