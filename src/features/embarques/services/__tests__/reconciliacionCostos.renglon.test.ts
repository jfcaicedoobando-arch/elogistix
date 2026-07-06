/**
 * Tests para clasificación por renglón y resúmenes agregados (Fase 3 —
 * conciliación a nivel de partidas).
 */
import { describe, it, expect } from "vitest";
import {
  clasificarRenglon,
  calcularResumenPorEstatus,
  calcularResumenPorMoneda,
  buildFilasReconciliacion,
  TOLERANCIA_CONCILIACION,
  type FilaReconciliacion,
} from "../reconciliacionCostos";

describe("clasificarRenglon", () => {
  it("sin facturas → sin_match aunque cotizado > 0", () => {
    expect(clasificarRenglon(100, 0, false)).toBe("sin_match");
  });
  it("cotizado 0 y real 0 con facturas → conciliado", () => {
    expect(clasificarRenglon(0, 0, true)).toBe("conciliado");
  });
  it("cotizado 0 y real > 0 con facturas → excedente", () => {
    expect(clasificarRenglon(0, 50, true)).toBe("excedente");
  });
  it("real dentro del ±1% → conciliado (arriba)", () => {
    expect(clasificarRenglon(1000, 1005, true)).toBe("conciliado");
  });
  it("real dentro del ±1% → conciliado (abajo)", () => {
    expect(clasificarRenglon(1000, 995, true)).toBe("conciliado");
  });
  it("real justo por encima del umbral superior → excedente", () => {
    const real = 1000 * (1 + TOLERANCIA_CONCILIACION) + 1;
    expect(clasificarRenglon(1000, real, true)).toBe("excedente");
  });
  it("real justo por debajo del umbral inferior → parcial", () => {
    const real = 1000 * (1 - TOLERANCIA_CONCILIACION) - 1;
    expect(clasificarRenglon(1000, real, true)).toBe("parcial");
  });
});

describe("calcularResumenPorEstatus", () => {
  it("cuenta cada estatus por separado", () => {
    const f = (id: string, estatus: FilaReconciliacion["estatus_renglon"]): FilaReconciliacion => ({
      concepto_costo_id: id, concepto: "", proveedor_nombre: "", moneda: "MXN",
      cotizado: 0, real_facturado: 0, diferencia: 0, desviacion_pct: 0,
      estado_liquidacion: "Pendiente", estatus_renglon: estatus, facturas: [],
    });
    const r = calcularResumenPorEstatus([
      f("1", "sin_match"), f("2", "sin_match"),
      f("3", "parcial"),
      f("4", "conciliado"), f("5", "conciliado"), f("6", "conciliado"),
      f("7", "excedente"),
    ]);
    expect(r).toEqual({ sin_match: 2, parcial: 1, conciliado: 3, excedente: 1 });
  });
});

describe("calcularResumenPorMoneda", () => {
  it("segrega y recalcula diferencia/% por moneda", () => {
    const filas: FilaReconciliacion[] = [
      { concepto_costo_id: "a", concepto: "", proveedor_nombre: "", moneda: "MXN",
        cotizado: 1000, real_facturado: 1100, diferencia: 100, desviacion_pct: 10,
        estado_liquidacion: "Pagado", estatus_renglon: "excedente", facturas: [] },
      { concepto_costo_id: "b", concepto: "", proveedor_nombre: "", moneda: "USD",
        cotizado: 200, real_facturado: 180, diferencia: -20, desviacion_pct: -10,
        estado_liquidacion: "Pendiente", estatus_renglon: "parcial", facturas: [] },
      { concepto_costo_id: "c", concepto: "", proveedor_nombre: "", moneda: "MXN",
        cotizado: 500, real_facturado: 500, diferencia: 0, desviacion_pct: 0,
        estado_liquidacion: "Pagado", estatus_renglon: "conciliado", facturas: [] },
    ];
    const t = calcularResumenPorMoneda(filas).sort((a, b) => a.moneda.localeCompare(b.moneda));
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ moneda: "MXN", cotizado: 1500, real: 1600, diferencia: 100 });
    expect(t[1]).toMatchObject({ moneda: "USD", cotizado: 200, real: 180, diferencia: -20 });
  });
});

describe("buildFilasReconciliacion (Fase 3)", () => {
  it("popula estatus_renglon coherente con clasificarRenglon", () => {
    const conceptos = [
      { id: "cc-1", concepto: "Flete", proveedor_nombre: "X", moneda: "USD", monto: 1000, estado_liquidacion: "Pendiente" },
      { id: "cc-2", concepto: "THC",   proveedor_nombre: "Y", moneda: "USD", monto: 200,  estado_liquidacion: "Pendiente" },
      { id: "cc-3", concepto: "Doc",   proveedor_nombre: "Z", moneda: "USD", monto: 100,  estado_liquidacion: "Pendiente" },
    ];
    const vinc = [
      // cc-1 conciliado exacto
      { monto: 1000, concepto_costo_id: "cc-1", descripcion: "Flete mar", proveedor_facturas: { id: "f1", folio_proveedor: "A-1", fecha_emision: "2026-06-01", deleted_at: null } },
      // cc-2 parcial (50% del cotizado)
      { monto: 100, concepto_costo_id: "cc-2", descripcion: "THC dest", proveedor_facturas: { id: "f2", folio_proveedor: "A-2", fecha_emision: "2026-06-02", deleted_at: null } },
      // cc-3 no tiene vínculos → sin_match
    ];
    const filas = buildFilasReconciliacion(conceptos, vinc);
    const byId = Object.fromEntries(filas.map((f) => [f.concepto_costo_id, f]));
    expect(byId["cc-1"].estatus_renglon).toBe("conciliado");
    expect(byId["cc-2"].estatus_renglon).toBe("parcial");
    expect(byId["cc-3"].estatus_renglon).toBe("sin_match");
    expect(byId["cc-1"].facturas[0]).toMatchObject({
      descripcion: "Flete mar",
      fecha_emision: "2026-06-01",
    });
  });
});
