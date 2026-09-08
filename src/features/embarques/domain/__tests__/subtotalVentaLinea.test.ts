/**
 * R219-UI-01 — La vista previa del Paso 4 debe usar la MISMA regla monetaria
 * que la persistencia (`cantidad × precio unitario`).
 */
import { describe, it, expect } from "vitest";
import { subtotalVentaLinea, cantidadVentaValida } from "../subtotalVentaLinea";

describe("subtotalVentaLinea", () => {
  it("multiplica cantidad × precio unitario (caso COT-2026-0010)", () => {
    expect(subtotalVentaLinea(2, 1184.5)).toBeCloseTo(2369, 2);
  });

  it("cantidad 1 deja el precio unitario intacto", () => {
    expect(subtotalVentaLinea(1, 1184.5)).toBeCloseTo(1184.5, 2);
  });

  it("cantidad ausente o inválida se trata como 1 (sin inventar otros defaults)", () => {
    expect(cantidadVentaValida(undefined)).toBe(1);
    expect(cantidadVentaValida(0)).toBe(1);
    expect(cantidadVentaValida(-3)).toBe(1);
    expect(cantidadVentaValida(Number.NaN)).toBe(1);
    expect(subtotalVentaLinea(undefined, 500)).toBeCloseTo(500, 2);
  });

  it("precio inválido no propaga NaN", () => {
    expect(subtotalVentaLinea(2, Number.NaN)).toBe(0);
  });
});
