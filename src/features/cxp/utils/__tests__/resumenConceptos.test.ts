import { describe, it, expect } from "vitest";
import {
  calcularResumenConceptos,
  totalLineaConImpuestos,
} from "../resumenConceptos";

describe("resumenConceptos", () => {
  it("suma total de línea con impuestos", () => {
    expect(totalLineaConImpuestos({ monto: 70, cantidad: 1, iva: 11.2 })).toBe(81.2);
    expect(totalLineaConImpuestos({ monto: 10, cantidad: 3, iva: 4.8, ieps: 1 })).toBe(35.8);
  });

  it("calcula subtotal, IVA y total sin documento de referencia", () => {
    const r = calcularResumenConceptos([
      { monto: 70, cantidad: 1, iva: 11.2 },
      { monto: 85, cantidad: 1, iva: 13.6 },
    ]);
    expect(r.subtotal).toBe(155);
    expect(r.iva).toBe(24.8);
    expect(r.ieps).toBe(0);
    expect(r.total).toBe(179.8);
    expect(r.cuadra).toBe(true);
  });

  it("resta retenciones del total calculado", () => {
    const r = calcularResumenConceptos(
      [{ monto: 1000, cantidad: 1, iva: 160, ieps: 40 }],
      { retenciones: 100, total: 1100 },
    );
    expect(r.ieps).toBe(40);
    expect(r.retenciones).toBe(100);
    expect(r.totalCalculado).toBe(1100);
    expect(r.cuadra).toBe(true);
    expect(r.diferencia).toBe(0);
  });

  it("detecta descuadre contra el total del documento", () => {
    const r = calcularResumenConceptos(
      [{ monto: 100, cantidad: 1, iva: 16 }],
      { total: 100 },
    );
    expect(r.cuadra).toBe(false);
    expect(r.diferencia).toBeCloseTo(-16, 2);
    expect(r.total).toBe(100);
  });

  it("tolera diferencias de un centavo", () => {
    const r = calcularResumenConceptos(
      [{ monto: 100, cantidad: 1, iva: 16 }],
      { total: 116.01 },
    );
    expect(r.cuadra).toBe(true);
    expect(r.diferencia).toBe(0);
  });
});
