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
  it("devuelve fila USD con cantidad = W/M y costo = tarifaWM (sin mínimo)", () => {
    const filas = buildCostosLCLManual({
      lclFleteManual: { tarifaWM: 50, minimo: 0, diasLibresAlmacenaje: 7, consolidadorId: null },
      dimensiones: [dim(10)],
      pesoKg: 5000, // 5 t → menor que 10 m³ → W/M = 10
      consolidadorNombre: "ACME LCL",
    });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      concepto: "Flete marítimo LCL",
      moneda: "USD",
      proveedor: "ACME LCL",
      cantidad: 10,
      costo_unitario: 50,
      precio_venta: 50,
      unidad_medida: "W/M",
      aplica_iva: false,
    });
  });

  it("respeta el mínimo cuando W/M × tarifa es menor", () => {
    const filas = buildCostosLCLManual({
      lclFleteManual: { tarifaWM: 20, minimo: 500, diasLibresAlmacenaje: 0, consolidadorId: null },
      dimensiones: [dim(5)],
      pesoKg: 1000, // 1 t → W/M = 5, venta base = 100, mínimo aplica → 500
    });
    expect(filas).toHaveLength(1);
    // precio unitario reproduce venta total 500 sobre 5 W/M = 100
    expect(filas[0].cantidad).toBe(5);
    expect(filas[0].costo_unitario).toBe(20);
    expect(filas[0].precio_venta).toBe(100);
    expect(filas[0].notas).toMatch(/aplica mínimo/i);
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
