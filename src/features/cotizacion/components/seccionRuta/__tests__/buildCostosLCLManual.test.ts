import { describe, it, expect } from "vitest";
import { buildCostosLCLManual } from "../buildCostosLCLManual";
import type { DimensionLCL } from "@/features/cotizacion/types/core";

const dim = (volumen_m3: number): DimensionLCL => ({
  piezas: 1,
  largo_cm: 0,
  ancho_cm: 0,
  alto_cm: 0,
  volumen_m3,
} as DimensionLCL);

describe("buildCostosLCLManual", () => {
  it("devuelve fila USD como 1 servicio con costo total = W/M × tarifa (sin mínimo)", () => {
    const filas = buildCostosLCLManual({
      lclFleteManual: { tarifaWM: 50, minimo: 0, diasLibresAlmacenaje: 7, consolidadorId: null },
      dimensiones: [dim(10)],
      pesoKg: 5000, // 5 t → menor que 10 m³ → W/M = 10 → total = 500
      consolidadorNombre: "ACME LCL",
    });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      concepto: "Flete marítimo LCL",
      moneda: "USD",
      proveedor: "ACME LCL",
      cantidad: 1,
      costo_unitario: 500,
      precio_venta: 500,
      unidad_medida: "Servicio",
      aplica_iva: false,
    });
    expect(filas[0].notas).toMatch(/W\/M facturable 10/);
  });

  it("respeta el mínimo cuando W/M × tarifa es menor", () => {
    const filas = buildCostosLCLManual({
      lclFleteManual: { tarifaWM: 20, minimo: 500, diasLibresAlmacenaje: 0, consolidadorId: null },
      dimensiones: [dim(5)],
      pesoKg: 1000, // 1 t → W/M = 5, calc = 100, aplica mínimo → 500
    });
    expect(filas).toHaveLength(1);
    expect(filas[0].cantidad).toBe(1);
    expect(filas[0].costo_unitario).toBe(100);
    expect(filas[0].precio_venta).toBe(500);
    expect(filas[0].unidad_medida).toBe("Servicio");
    expect(filas[0].notas).toMatch(/aplica mínimo/i);
  });

  it("B-075: aplica el markup configurable a la venta (como FCL)", () => {
    const filas = buildCostosLCLManual({
      lclFleteManual: { tarifaWM: 85, minimo: 120, diasLibresAlmacenaje: 0, consolidadorId: null },
      dimensiones: [dim(10)],
      pesoKg: 500, // 0.5 t → W/M = 10 → costo = 850; venta = 850 × 1.15 = 977.50
      markup: 0.15,
    });
    expect(filas).toHaveLength(1);
    expect(filas[0].costo_unitario).toBe(850); // el costo NO lleva markup
    expect(filas[0].precio_venta).toBe(977.5);
  });

  it("B-075: sin markup (default 0) conserva el comportamiento anterior", () => {
    const filas = buildCostosLCLManual({
      lclFleteManual: { tarifaWM: 85, minimo: 120, diasLibresAlmacenaje: 0, consolidadorId: null },
      dimensiones: [dim(10)],
      pesoKg: 500,
    });
    expect(filas[0].precio_venta).toBe(850);
  });

  it("devuelve [] si no hay dimensiones ni peso", () => {
    const filas = buildCostosLCLManual({
      lclFleteManual: { tarifaWM: 50, minimo: 0, diasLibresAlmacenaje: 0, consolidadorId: null },
      dimensiones: [],
      pesoKg: 0,
    });
    expect(filas).toEqual([]);
  });

  it("devuelve [] si no hay tarifa ni mínimo", () => {
    const filas = buildCostosLCLManual({
      lclFleteManual: { tarifaWM: 0, minimo: 0, diasLibresAlmacenaje: 0, consolidadorId: null },
      dimensiones: [dim(10)],
      pesoKg: 5000,
    });
    expect(filas).toEqual([]);
  });

  it("devuelve [] si lclFleteManual es null", () => {
    const filas = buildCostosLCLManual({
      lclFleteManual: null,
      dimensiones: [dim(10)],
      pesoKg: 5000,
    });
    expect(filas).toEqual([]);
  });
});
