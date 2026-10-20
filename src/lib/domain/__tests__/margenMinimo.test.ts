import { describe, expect, it } from "vitest";
import { evaluarMargenMinimo, normalizarMargenMinimo, puedeAutorizarMargenBajo } from "../margenMinimo";

describe("margen mínimo", () => {
  it("margen 7.5% con mínimo 8% requiere autorización", () => {
    expect(evaluarMargenMinimo(1000, 925, 8).debajoDelMinimo).toBe(true);
  });
  it("margen 12% con mínimo 8% no requiere autorización", () => {
    expect(evaluarMargenMinimo(1000, 880, 8).debajoDelMinimo).toBe(false);
  });
  it("margen exactamente 8% no requiere autorización", () => {
    expect(evaluarMargenMinimo(1000, 920, 8).debajoDelMinimo).toBe(false);
  });
  it("sin configuración usa 8%", () => {
    expect(normalizarMargenMinimo(undefined)).toBe(8);
    expect(normalizarMargenMinimo(10)).toBe(10);
  });
  it("gerente comercial autoriza, operador no", () => {
    expect(puedeAutorizarMargenBajo("gerente_comercial")).toBe(true);
    expect(puedeAutorizarMargenBajo("operador")).toBe(false);
  });
});
