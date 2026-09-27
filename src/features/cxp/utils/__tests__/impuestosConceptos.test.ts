import { describe, expect, it } from "vitest";
import { impuestosNoDesglosados, importesConceptosEditados } from "../impuestosConceptos";

describe("impuestos de conceptos manuales · AUD-F04", () => {
  const linea = { monto: 1000, cantidad: 1, iva: 172.8, ieps: 0 };
  it("editar una descripción conserva IEPS global, total y deuda", () => {
    const globales = impuestosNoDesglosados([linea], { iva: 172.8, ieps: 80 });
    expect(globales).toEqual({ iva: 0, ieps: 80 });
    expect(importesConceptosEditados([linea], globales, 0))
      .toEqual({ subtotal: 1000, iva: 172.8, ieps: 80, retenciones: 0, total: 1252.8 });
  });
  it("distribuir IEPS requiere descontar explícitamente el global", () => {
    const distribuida = { ...linea, ieps: 80 };
    expect(importesConceptosEditados([distribuida], { iva: 0, ieps: 0 }, 0).total).toBe(1252.8);
    expect(importesConceptosEditados([distribuida], { iva: 0, ieps: 80 }, 0).total).toBe(1332.8);
  });
  it("recalcula una edición monetaria sin multiplicar los impuestos por cantidad", () => {
    const r = importesConceptosEditados([{ monto: 1000, cantidad: 2, iva: 345.6, ieps: 160 }], { iva: 0, ieps: 0 }, 50);
    expect(r).toEqual({ subtotal: 2000, iva: 345.6, ieps: 160, retenciones: 50, total: 2455.6 });
  });
});
