/**
 * Ola v13.823.7 · P2 vencimiento: una factura que vence HOY no está vencida.
 * `calcularHero` usaba `T00:00:00Z` y la contaba como vencida mientras
 * `calcularAntiguedad` la dejaba en "Corriente"; ambos usan ahora
 * `diasVencidos(...) > 0`.
 */
import { describe, it, expect } from "vitest";
import { calcularAntiguedad, calcularHero } from "../calculos";
import type { FacturaRow } from "../loaders";

/** 15/01/2026, 10:00 en CDMX. */
const HOY = new Date("2026-01-15T10:00:00-06:00");

function factura(over: Partial<FacturaRow> = {}): FacturaRow {
  return {
    id: "f1", total: 1000, moneda: "MXN", tipo_cambio: null,
    fecha_emision: "2026-01-01", fecha_vencimiento: "2026-01-15", estado: "Emitida",
    cliente_id: "c1", timbrado_en: null, uuid_fiscal: null, acuse_cancelacion_status: null,
    ...over,
  };
}

const base = { aggs: [], facturas: [], fallbacks: { usd: 18, eur: 22 }, hoy: HOY, mesActual: "2026-01", mesPrev: "2025-12" };

function hero(facturasCartera: FacturaRow[]) {
  const antiguedad = calcularAntiguedad(facturasCartera, [], { usd: 18, eur: 22 }, HOY);
  return { antiguedad, kpis: calcularHero({ ...base, facturasCartera, antiguedad }) };
}

describe("vencimiento con criterio único", () => {
  it("una factura que vence HOY no cuenta como vencida (ni en monto ni en clientes)", () => {
    const { antiguedad, kpis } = hero([factura({ fecha_vencimiento: "2026-01-15" })]);
    expect(antiguedad.find((b) => b.bucket === "Corriente")!.facturas).toBe(1);
    expect(kpis.cartera_vencida_mxn).toBe(0);
    expect(kpis.cartera_vencida_clientes).toBe(0);
  });

  it("una factura que venció AYER sí cuenta como vencida", () => {
    const { antiguedad, kpis } = hero([factura({ fecha_vencimiento: "2026-01-14" })]);
    expect(antiguedad.find((b) => b.bucket === "1-30")!.facturas).toBe(1);
    expect(kpis.cartera_vencida_mxn).toBeCloseTo(1000, 2);
    expect(kpis.cartera_vencida_clientes).toBe(1);
  });

  it("monto y conteo de clientes usan el mismo universo", () => {
    const { kpis } = hero([
      factura({ id: "a", cliente_id: "c1", fecha_vencimiento: "2026-01-15" }),
      factura({ id: "b", cliente_id: "c2", fecha_vencimiento: "2026-01-10", total: 500 }),
    ]);
    expect(kpis.cartera_vencida_mxn).toBeCloseTo(500, 2);
    expect(kpis.cartera_vencida_clientes).toBe(1);
  });
});
