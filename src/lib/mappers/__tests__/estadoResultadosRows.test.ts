/**
 * Tests de mappers para Estado de Resultados Devengado.
 * Foco: coerción defensiva (null→null, "" → default num, valores tóxicos)
 * en boundary de Supabase. Sin estos mappers, NaN del payload se filtra
 * a totales financieros.
 */
import { describe, it, expect } from "vitest";
import {
  mapFacturaRows,
  mapNotaCreditoRows,
  mapProveedorFacturaRows,
  mapEmbarqueERRows,
  mapEmbarqueERConExpediente,
} from "../estadoResultadosRows";

describe("mapFacturaRows", () => {
  it("acepta data=null y devuelve []", () => {
    expect(mapFacturaRows(null)).toEqual([]);
  });
  it("mapea campos y nulables", () => {
    const out = mapFacturaRows([
      { id: "f1", expediente: null, total: "150.5", moneda: "MXN", fecha_emision: "2026-06-01", tipo_cambio: null },
    ]);
    expect(out[0]).toEqual({
      id: "f1", expediente: null, total: 150.5, moneda: "MXN", fecha_emision: "2026-06-01", tipo_cambio: null,
    });
  });
  it("convierte total inválido a 0 (no NaN)", () => {
    const out = mapFacturaRows([{ id: "f2", total: "NaN", moneda: "USD", fecha_emision: "2026-06-01" }]);
    expect(out[0].total).toBe(0);
  });
});

describe("mapNotaCreditoRows", () => {
  it("mapea filas básicas", () => {
    const out = mapNotaCreditoRows([
      { monto: 25, moneda: "MXN", factura_id: "f1", updated_at: "2026-06-10T00:00:00Z" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].monto).toBe(25);
    expect(out[0].factura_id).toBe("f1");
  });
});

describe("mapProveedorFacturaRows", () => {
  it("conserva embarque_id null y tipo_cambio_usd null", () => {
    const out = mapProveedorFacturaRows([
      { id: "p1", embarque_id: null, total: 99, moneda: "MXN", fecha_emision: "2026-06-01", tipo_cambio_usd: null },
    ]);
    expect(out[0].embarque_id).toBeNull();
    expect(out[0].tipo_cambio_usd).toBeNull();
  });
  it("coerce tipo_cambio_usd numérico", () => {
    const out = mapProveedorFacturaRows([
      { id: "p2", embarque_id: "e1", total: 50, moneda: "USD", fecha_emision: "2026-06-01", tipo_cambio_usd: "17.5" },
    ]);
    expect(out[0].tipo_cambio_usd).toBe(17.5);
    expect(out[0].embarque_id).toBe("e1");
  });
});

describe("mapEmbarqueERRows", () => {
  it("mapea modo y tipos de cambio opcionales", () => {
    const out = mapEmbarqueERRows([
      { id: "e1", modo: "MAR", tipo_cambio_usd: 17.2, tipo_cambio_eur: null },
    ]);
    expect(out[0]).toEqual({ id: "e1", modo: "MAR", tipo_cambio_usd: 17.2, tipo_cambio_eur: null });
  });
});

describe("mapEmbarqueERConExpediente", () => {
  it("incluye expediente nullable", () => {
    const out = mapEmbarqueERConExpediente([
      { id: "e1", modo: "AER", tipo_cambio_usd: null, tipo_cambio_eur: null, expediente: "EXP-001" },
      { id: "e2", modo: "TER", tipo_cambio_usd: 17, tipo_cambio_eur: 20, expediente: null },
    ]);
    expect(out[0].expediente).toBe("EXP-001");
    expect(out[1].expediente).toBeNull();
  });
});
