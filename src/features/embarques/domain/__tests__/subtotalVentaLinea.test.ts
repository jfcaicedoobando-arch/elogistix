/**
 * R219-UI-01 — La vista previa del Paso 4 debe usar la MISMA regla monetaria
 * y la MISMA validación de cantidad (`>= 1`) que la persistencia.
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

  it("cambiar la cantidad recalcula el subtotal", () => {
    expect(subtotalVentaLinea(3, 1184.5)).toBeCloseTo(3553.5, 2);
    expect(subtotalVentaLinea(1.5, 1000)).toBeCloseTo(1500, 2);
  });

  it("cantidad AUSENTE se lee como 1 (fila legacy sin columna)", () => {
    expect(cantidadVentaValida(undefined)).toBe(1);
    expect(cantidadVentaValida(null)).toBe(1);
    expect(subtotalVentaLinea(undefined, 500)).toBeCloseTo(500, 2);
  });

  it("0, negativos y NaN son inválidos: aportan 0, nunca 1", () => {
    expect(cantidadVentaValida(0)).toBeNull();
    expect(cantidadVentaValida(-3)).toBeNull();
    expect(cantidadVentaValida(Number.NaN)).toBeNull();
    expect(subtotalVentaLinea(0, 1184.5)).toBe(0);
    expect(subtotalVentaLinea(-2, 1184.5)).toBe(0);
    expect(subtotalVentaLinea(Number.NaN, 1184.5)).toBe(0);
  });

  it("precio inválido no propaga NaN", () => {
    expect(subtotalVentaLinea(2, Number.NaN)).toBe(0);
  });
});
