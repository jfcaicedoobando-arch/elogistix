import { describe, expect, it } from "vitest";
import { evaluarFuerza, generarPassword } from "../generator";

describe("generarPassword", () => {
  it("genera longitud exacta solicitada", () => {
    expect(generarPassword(12)).toHaveLength(12);
    expect(generarPassword(16)).toHaveLength(16);
  });

  it("clampa a [8, 64]", () => {
    expect(generarPassword(4)).toHaveLength(8);
    expect(generarPassword(100)).toHaveLength(64);
  });

  it("incluye al menos un char de cada charset", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generarPassword(12);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("produce contraseñas distintas en llamadas sucesivas", () => {
    const a = generarPassword(12);
    const b = generarPassword(12);
    expect(a).not.toEqual(b);
  });
});

describe("evaluarFuerza", () => {
  it("vacía → score 0", () => {
    expect(evaluarFuerza("").score).toBe(0);
  });

  it("corta y débil → score 1", () => {
    expect(evaluarFuerza("abc").score).toBe(1);
  });

  it("aceptable: 10 chars con 3 charsets → score 3", () => {
    const r = evaluarFuerza("Abcdef1234");
    expect(r.score).toBeGreaterThanOrEqual(3);
  });

  it("fuerte: 12+ chars con 4 charsets → score 4", () => {
    expect(evaluarFuerza("Abcdef12!#xy").score).toBe(4);
  });

  it("etiqueta humana presente cuando hay score", () => {
    const r = evaluarFuerza("Abc12!xy");
    expect(r.label.length).toBeGreaterThan(0);
  });
});
