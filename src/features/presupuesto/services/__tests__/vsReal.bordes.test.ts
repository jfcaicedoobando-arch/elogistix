import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Casos borde de cálculo de Presupuesto vs Real:
 *  - presupuesto = 0 → cumplimiento_pct = 0 (sin div/0)
 *  - moneda != MXN con tipo_cambio_usd válido → multiplica
 *  - tipo_cambio_usd null/0 → usa monto sin convertir (NO multiplica por 0)
 *  - filas sin gastos ni presupuesto → totales = 0
 */
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

vi.mock("../categorias", () => ({
  fetchCategorias: vi.fn().mockResolvedValue([
    { id: "cat-fletes", nombre: "Fletes" },
    { id: "cat-com", nombre: "Comisiones" },
  ]),
}));
vi.mock("../mensual", () => ({
  fetchPresupuestoMensualAnio: vi.fn().mockResolvedValue([
    { categoria_id: "cat-fletes", periodo: "2026-06", monto_mxn: 0 }, // presupuesto cero
  ]),
}));

import { fetchPresupuestoVsReal } from "../vsReal";

describe("fetchPresupuestoVsReal — bordes", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("presupuesto=0 → cumplimiento_pct=0 (no NaN ni Infinity)", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [{ categoria_presupuesto_id: "cat-fletes", total: 500, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-10" }],
      error: null,
    });
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });

    const res = await fetchPresupuestoVsReal("2026-06");
    const fletes = res.filas.find((f) => f.categoria_id === "cat-fletes")!;
    expect(fletes.presupuesto_mxn).toBe(0);
    expect(fletes.real_mxn).toBe(500);
    expect(fletes.cumplimiento_pct).toBe(0);
    expect(Number.isFinite(fletes.cumplimiento_pct)).toBe(true);
  });

  it("moneda USD con tipo_cambio_usd válido convierte a MXN", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [{ categoria_presupuesto_id: "cat-fletes", total: 100, moneda: "USD", tipo_cambio_usd: 20, fecha_emision: "2026-06-10" }],
      error: null,
    });
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });

    const res = await fetchPresupuestoVsReal("2026-06");
    const fletes = res.filas.find((f) => f.categoria_id === "cat-fletes")!;
    expect(fletes.real_mxn).toBe(2000);
  });

  // Ola 5 · A7: sin TC no se puede valuar en pesos; el gasto se excluye del real
  // y se reporta en `gastos_sin_tc_count` en vez de asumir 1 USD = 1 MXN.
  it("USD con tipo_cambio_usd=null se excluye del real y se cuenta como sin TC", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [{ categoria_presupuesto_id: "cat-fletes", total: 100, moneda: "USD", tipo_cambio_usd: null, fecha_emision: "2026-06-10" }],
      error: null,
    });
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });

    const res = await fetchPresupuestoVsReal("2026-06");
    const fletes = res.filas.find((f) => f.categoria_id === "cat-fletes");
    expect(fletes?.real_mxn ?? 0).toBe(0);
    expect(res.gastos_sin_tc_count).toBe(1);
  });

  it("liquidaciones se mapean a la categoría 'Comisiones' por nombre", async () => {
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    mock.setTableResult("liquidaciones_comision", {
      data: [{ total_mxn: 750, periodo: "2026-06" }],
      error: null,
    });
    const res = await fetchPresupuestoVsReal("2026-06");
    const com = res.filas.find((f) => f.categoria_id === "cat-com")!;
    expect(com.real_mxn).toBe(750);
    expect(res.total_real_mxn).toBe(750);
  });

  it("sin gastos ni presupuesto → totales y variación = 0", async () => {
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });
    const res = await fetchPresupuestoVsReal("2026-06");
    expect(res.total_presupuesto_mxn).toBe(0);
    expect(res.total_real_mxn).toBe(0);
    expect(res.variacion_neta_mxn).toBe(0);
    expect(res.filas.every((f) => f.cumplimiento_pct === 0)).toBe(true);
  });
});
