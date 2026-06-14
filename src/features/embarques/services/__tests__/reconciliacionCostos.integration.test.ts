/**
 * B.3.3 — Integración Factura Proveedor → Conciliación.
 *
 * Ejercita la composición real de `buildFilasReconciliacion` +
 * `calcularResumen` + `calcularDesviacionPct` sobre escenarios end-to-end
 * de un embarque (varios conceptos, varios proveedores, facturas múltiples,
 * soft-deletes y vínculos huérfanos). Sin Supabase: sólo lógica pura.
 */
import { describe, expect, it } from "vitest";
import {
  buildFilasReconciliacion,
  calcularDesviacionPct,
  calcularResumen,
} from "@/features/embarques/services/reconciliacionCostos";

describe("B.3.3 flujo Factura proveedor → Conciliación", () => {
  it("embarque real: 3 conceptos, 2 proveedores, mezcla de over/under/sin factura", () => {
    const conceptos = [
      { id: "cc-flete", concepto: "Flete", proveedor_nombre: "Naviera X", moneda: "USD", monto: 2000, estado_liquidacion: "Pendiente" },
      { id: "cc-thc", concepto: "THC", proveedor_nombre: "Naviera X", moneda: "USD", monto: 300, estado_liquidacion: "Pendiente" },
      { id: "cc-maniobras", concepto: "Maniobras", proveedor_nombre: "Agente Y", moneda: "MXN", monto: 5000, estado_liquidacion: "Pendiente" },
    ];
    const vinculos = [
      // Flete: dos parciales que suman exactamente el cotizado.
      { monto: 1500, concepto_costo_id: "cc-flete", proveedor_facturas: { id: "f1", folio_proveedor: "NX-100", deleted_at: null } },
      { monto: 500, concepto_costo_id: "cc-flete", proveedor_facturas: { id: "f2", folio_proveedor: "NX-101", deleted_at: null } },
      // THC: una factura por encima del cotizado (over).
      { monto: 360, concepto_costo_id: "cc-thc", proveedor_facturas: { id: "f3", folio_proveedor: "NX-102", deleted_at: null } },
      // Maniobras: una factura, pero soft-deleted → no cuenta.
      { monto: 5000, concepto_costo_id: "cc-maniobras", proveedor_facturas: { id: "f4", folio_proveedor: "AY-1", deleted_at: "2026-05-01" } },
      // Vínculo huérfano (factura purgada) → ignorado.
      { monto: 999, concepto_costo_id: "cc-flete", proveedor_facturas: null },
      // Vínculo sin concepto_costo_id → ignorado.
      { monto: 999, concepto_costo_id: null, proveedor_facturas: { id: "f5", folio_proveedor: "X", deleted_at: null } },
    ];

    const filas = buildFilasReconciliacion(conceptos, vinculos);
    expect(filas).toHaveLength(3);

    const flete = filas.find((f) => f.concepto_costo_id === "cc-flete")!;
    expect(flete.real_facturado).toBe(2000);
    expect(flete.diferencia).toBe(0);
    expect(flete.desviacion_pct).toBe(0);
    expect(flete.facturas).toHaveLength(2);

    const thc = filas.find((f) => f.concepto_costo_id === "cc-thc")!;
    expect(thc.real_facturado).toBe(360);
    expect(thc.diferencia).toBe(60);
    expect(thc.desviacion_pct).toBeCloseTo(20, 5);

    const man = filas.find((f) => f.concepto_costo_id === "cc-maniobras")!;
    expect(man.real_facturado).toBe(0);
    expect(man.facturas).toHaveLength(0);
    expect(man.diferencia).toBe(-5000);

    const resumen = calcularResumen(filas);
    expect(resumen.total_cotizado).toBe(7300);
    expect(resumen.total_real).toBe(2360);
    expect(resumen.diferencia_total).toBe(-4940);
    expect(resumen.conceptos_sin_factura).toBe(1);
    // -4940 / 7300 * 100
    expect(resumen.desviacion_pct_total).toBeCloseTo(-67.6712, 3);
  });

  it("cotizado 0 con real > 0 marca 100% desviación en fila y resumen", () => {
    const conceptos = [
      { id: "cc-extra", concepto: "Extra no cotizado", proveedor_nombre: "Z", moneda: "USD", monto: 0, estado_liquidacion: "Pendiente" },
    ];
    const vinculos = [
      { monto: 250, concepto_costo_id: "cc-extra", proveedor_facturas: { id: "f", folio_proveedor: "Z-1", deleted_at: null } },
    ];
    const filas = buildFilasReconciliacion(conceptos, vinculos);
    expect(filas[0].desviacion_pct).toBe(100);
    const r = calcularResumen(filas);
    expect(r.desviacion_pct_total).toBe(100);
    expect(r.conceptos_sin_factura).toBe(0);
  });

  it("cero conceptos → resumen totalmente cero", () => {
    expect(calcularResumen(buildFilasReconciliacion([], []))).toEqual({
      total_cotizado: 0,
      total_real: 0,
      diferencia_total: 0,
      desviacion_pct_total: 0,
      conceptos_sin_factura: 0,
    });
  });

  it("composición: desviacion_pct de cada fila coincide con calcularDesviacionPct directo", () => {
    const conceptos = [
      { id: "a", concepto: "", proveedor_nombre: "", moneda: "USD", monto: 800, estado_liquidacion: "" },
      { id: "b", concepto: "", proveedor_nombre: "", moneda: "USD", monto: 1200, estado_liquidacion: "" },
    ];
    const vinculos = [
      { monto: 1000, concepto_costo_id: "a", proveedor_facturas: { id: "fa", folio_proveedor: "A", deleted_at: null } },
      { monto: 1080, concepto_costo_id: "b", proveedor_facturas: { id: "fb", folio_proveedor: "B", deleted_at: null } },
    ];
    const filas = buildFilasReconciliacion(conceptos, vinculos);
    expect(filas[0].desviacion_pct).toBe(calcularDesviacionPct(800, 1000));
    expect(filas[1].desviacion_pct).toBe(calcularDesviacionPct(1200, 1080));
  });
});
