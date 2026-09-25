/**
 * v13.823.370 (P2-4) — El resumen del grupo de costos no debe imprimir
 * categorías en cero ("0 con ajuste, 1 sin factura").
 */
import { describe, it, expect } from "vitest";
import { etiquetaConteos } from "../grupoCostosProveedorHelpers";

describe("etiquetaConteos", () => {
  it("omite 'con ajuste' cuando es cero", () => {
    expect(etiquetaConteos(0, 1)).toBe("1 concepto sin factura");
  });

  it("omite 'sin factura' cuando es cero", () => {
    expect(etiquetaConteos(2, 0)).toBe("2 con ajuste");
  });

  it("muestra ambas categorías cuando ambas aplican", () => {
    expect(etiquetaConteos(2, 3)).toBe("2 con ajuste, 3 conceptos sin factura");
  });

  it("devuelve null cuando no hay nada que reportar", () => {
    expect(etiquetaConteos(0, 0)).toBeNull();
  });
});
