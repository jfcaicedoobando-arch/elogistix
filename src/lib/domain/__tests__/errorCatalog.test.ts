import { describe, it, expect } from "vitest";
import { msg, getMessage } from "@/lib/domain/errorCatalog";

describe("msg", () => {
  it("devuelve mensajes estáticos con formato Campo: razón.", () => {
    expect(msg("1.modo.required")).toMatch(/Modo de transporte/);
    expect(msg("2.eta.afterEtd")).toMatch(/igual o posterior/);
  });
  it("devuelve la key como fallback si no existe", () => {
    expect(msg("inexistente.key")).toBe("inexistente.key");
  });
});

describe("getMessage", () => {
  it("interpola tamaño en 3.documento.tooLarge", () => {
    const out = getMessage("3.documento.tooLarge", { nombre: "BL.pdf", sizeMb: "12.3", maxMb: 10 });
    expect(out).toContain("BL.pdf");
    expect(out).toContain("12.3");
    expect(out).toContain("10");
  });
  it("interpola id en 4.venta.invalid", () => {
    expect(getMessage("4.venta.invalid", { id: 7 })).toContain("#7");
  });
});
