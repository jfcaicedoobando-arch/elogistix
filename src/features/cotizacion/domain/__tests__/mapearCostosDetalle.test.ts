/**
 * v13.823.345 — Regresión: `precio_venta` explícito en 0 debe conservarse.
 * Antes el fallback al concepto de venta reponía la venta vieja y reaparecía
 * una utilidad fantasma en el P&L de detalle.
 */
import { describe, it, expect } from "vitest";
import { mapearCostosAFilas } from "../mapearCostosDetalle";
import type { CostoCotizacion, ConceptoVentaCotizacion } from "@/features/cotizacion/types";

function costo(over: Partial<CostoCotizacion> = {}): CostoCotizacion {
  return {
    id: "c1",
    cotizacion_id: "cot1",
    concepto: "Flete marítimo",
    moneda: "MXN",
    proveedor: "Naviera",
    cantidad: 2,
    costo_unitario: 100,
    costo_total: 200,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

function concepto(over: Partial<ConceptoVentaCotizacion> = {}): ConceptoVentaCotizacion {
  return {
    descripcion: "Flete marítimo",
    unidad_medida: "",
    cantidad: 2,
    precio_unitario: 500,
    moneda: "MXN",
    total: 1000,
    aplica_iva: false,
    ...over,
  };
}

describe("mapearCostosAFilas", () => {
  it("respeta precio_venta = 0 explícito (sin utilidad fantasma)", () => {
    const filas = mapearCostosAFilas([costo({ precio_venta: 0 })], [], [concepto()]);
    expect(filas[0].venta).toBe(0);
  });

  it("usa el precio_venta persistido cuando es > 0", () => {
    const filas = mapearCostosAFilas([costo({ precio_venta: 300 })], [], [concepto()]);
    expect(filas[0].venta).toBe(600);
  });

  it("legacy sin precio_venta cae al concepto de venta", () => {
    const filas = mapearCostosAFilas([costo()], [], [concepto()]);
    expect(filas[0].venta).toBe(1000);
  });

  it("nombre duplicado: match ambiguo deja la venta en 0", () => {
    const filas = mapearCostosAFilas([costo()], [], [concepto(), concepto({ precio_unitario: 900 })]);
    expect(filas[0].venta).toBe(0);
  });
});
