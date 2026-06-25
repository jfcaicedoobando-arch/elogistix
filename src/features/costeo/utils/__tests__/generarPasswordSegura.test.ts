import { describe, it, expect } from "vitest";
import { generarPasswordSegura } from "../generarPasswordSegura";

describe("generarPasswordSegura", () => {
  it("genera una contraseña de 12 caracteres", () => {
    for (let i = 0; i < 20; i++) {
      const p = generarPasswordSegura();
      expect(p).toHaveLength(12);
    }
  });

  it("contiene únicamente caracteres del alfabeto permitido", () => {
    const allow = /^[a-zA-Z0-9!@#$%*\-_]+$/;
    for (let i = 0; i < 10; i++) {
      expect(generarPasswordSegura()).toMatch(allow);
    }
  });
});
