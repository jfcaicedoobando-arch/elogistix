/**
 * Tests para la conciliación cotizado vs real (Fase 2).
 * Sólo prueba lo puro — Supabase está cubierto por convenciones generales.
 */
import { describe, it, expect } from "vitest";
import {
  buildFilasReconciliacion,
  calcularDesviacionPct,
  calcularResumen,
} from "../reconciliacionCostos";

describe("calcularDesviacionPct", () => {
  it("0 cotizado y 0 real → 0%", () => {
    expect(calcularDesviacionPct(0, 0)).toBe(0);
  });
  it("0 cotizado y real > 0 → 100% (todo es desviación)", () => {
    expect(calcularDesviacionPct(0, 500)).toBe(100);
  });
  it("calcula positivo cuando el real supera al cotizado", () => {
    expect(calcularDesviacionPct(100, 120)).toBe(20);
  });
  it("calcula negativo cuando el real es menor (ahorro)", () => {
    expect(calcularDesviacionPct(100, 90)).toBe(-10);
  });
});

describe("buildFilasReconciliacion", () => {
  const conceptos = [
    { id: "cc-1", concepto: "Flete", proveedor_nombre: "Naviera X", moneda: "USD", monto: 1000, estado_liquidacion: "Pendiente" },
    { id: "cc-2", concepto: "THC", proveedor_nombre: "Agente Y", moneda: "USD", monto: 200, estado_liquidacion: "Pendiente" },
  ];

  it("agrupa varias facturas vinculadas al mismo concepto", () => {
    const vinc = [
      { monto: 600, concepto_costo_id: "cc-1", proveedor_facturas: { id: "f1", folio_proveedor: "A-1", deleted_at: null } },
      { monto: 400, concepto_costo_id: "cc-1", proveedor_facturas: { id: "f2", folio_proveedor: "A-2", deleted_at: null } },
    ];
    const filas = buildFilasReconciliacion(conceptos, vinc);
    expect(filas[0].real_facturado).toBe(1000);
    expect(filas[0].diferencia).toBe(0);
    expect(filas[0].desviacion_pct).toBe(0);
    expect(filas[0].facturas).toHaveLength(2);
  });

  it("ignora vínculos cuyas facturas estén soft-deleted", () => {
    const vinc = [
      { monto: 500, concepto_costo_id: "cc-1", proveedor_facturas: { id: "f1", folio_proveedor: "A-1", deleted_at: "2026-01-01" } },
    ];
    const filas = buildFilasReconciliacion(conceptos, vinc);
    expect(filas[0].real_facturado).toBe(0);
    expect(filas[0].facturas).toHaveLength(0);
  });

  it("marca conceptos sin vínculo con real=0 y conserva el cotizado", () => {
    const filas = buildFilasReconciliacion(conceptos, []);
    expect(filas[1].real_facturado).toBe(0);
    expect(filas[1].cotizado).toBe(200);
    expect(filas[1].diferencia).toBe(-200);
  });
});

describe("calcularResumen", () => {
  it("agrega totales y cuenta conceptos sin factura", () => {
    const filas = [
      { concepto_costo_id: "a", concepto: "", proveedor_nombre: "", moneda: "USD",
        cotizado: 1000, real_facturado: 1100, diferencia: 100, desviacion_pct: 10,
        estado_liquidacion: "Pagado", estatus_renglon: "excedente" as const,
        facturas: [{ proveedor_factura_id: "f", folio_proveedor: "F", fecha_emision: null, fecha_vencimiento: null, estatus_pago: null, descripcion: null, monto: 1100 }] },
      { concepto_costo_id: "b", concepto: "", proveedor_nombre: "", moneda: "USD",
        cotizado: 500, real_facturado: 0, diferencia: -500, desviacion_pct: -100,
        estado_liquidacion: "Pendiente", estatus_renglon: "sin_match" as const, facturas: [] },
    ];
    const r = calcularResumen(filas);
    expect(r.total_cotizado).toBe(1500);
    expect(r.total_real).toBe(1100);
    expect(r.diferencia_total).toBe(-400);
    expect(r.conceptos_sin_factura).toBe(1);
  });

  it("desviación total 0 con lista vacía", () => {
    expect(calcularResumen([])).toEqual({
      total_cotizado: 0, total_real: 0, diferencia_total: 0,
      desviacion_pct_total: 0, conceptos_sin_factura: 0,
    });
  });
});
