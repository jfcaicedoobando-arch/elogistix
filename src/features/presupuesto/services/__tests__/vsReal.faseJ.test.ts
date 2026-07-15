/**
 * Fase J · derivados de sobreejercicio en `fetchPresupuestoVsReal`:
 * - `categorias_en_exceso` cuenta filas con `presupuesto > 0 && cumplimiento > 110`.
 * - `top_exceso` ordena por `variacion_mxn` desc y toma top 5.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

vi.mock("../categorias", () => ({
  fetchCategorias: vi.fn().mockResolvedValue([
    { id: "c1", nombre: "Viajes" },
    { id: "c2", nombre: "Comisiones" },
    { id: "c3", nombre: "Renta" },
    { id: "c4", nombre: "Servicios" },
    { id: "c5", nombre: "Marketing" },
    { id: "c6", nombre: "Software" },
    { id: "c7", nombre: "Papelería" },
  ]),
}));
vi.mock("../mensual", () => ({
  fetchPresupuestoMensualAnio: vi.fn().mockResolvedValue([
    { categoria_id: "c1", periodo: "2026-06", monto_mxn: 1000 },
    { categoria_id: "c2", periodo: "2026-06", monto_mxn: 2000 },
    { categoria_id: "c3", periodo: "2026-06", monto_mxn: 3000 },
    { categoria_id: "c4", periodo: "2026-06", monto_mxn: 1000 },
    { categoria_id: "c5", periodo: "2026-06", monto_mxn: 1000 },
    { categoria_id: "c6", periodo: "2026-06", monto_mxn: 500 },
    // c7 sin presupuesto: real >0 pero no debe contar como exceso
  ]),
}));

import { fetchPresupuestoVsReal } from "../vsReal";

describe("vsReal · Fase J derivados", () => {
  beforeEach(() => { mock.tableCalls.length = 0; });

  it("categorias_en_exceso cuenta sólo filas con presupuesto>0 y cumplimiento>110%", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [
        // c1: 1500 real / 1000 pres = 150% → excede
        { categoria_presupuesto_id: "c1", total: 1500, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-15" },
        // c3: 3300 / 3000 = 110% → NO excede (umbral es estrictamente >110)
        { categoria_presupuesto_id: "c3", total: 3200, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-15" },
        // c4: 5000 / 1000 = 500% → excede
        { categoria_presupuesto_id: "c4", total: 5000, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-15" },
        // c7 sin presupuesto: aunque tenga real, no cuenta
        { categoria_presupuesto_id: "c7", total: 999, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-15" },
      ],
      error: null,
    });
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });

    const res = await fetchPresupuestoVsReal("2026-06");
    expect(res.categorias_en_exceso).toBe(2); // c1 y c4
  });

  it("top_exceso ordena por variacion_mxn desc y limita a 5", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [
        { categoria_presupuesto_id: "c1", total: 1500, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-15" }, // var +500
        { categoria_presupuesto_id: "c4", total: 5000, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-15" }, // var +4000
        { categoria_presupuesto_id: "c5", total: 2000, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-15" }, // var +1000
        { categoria_presupuesto_id: "c6", total: 1200, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-15" }, // var +700
      ],
      error: null,
    });
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });

    const res = await fetchPresupuestoVsReal("2026-06");
    expect(res.top_exceso.map((f) => f.categoria_id)).toEqual(["c4", "c5", "c6", "c1"]);
    expect(res.top_exceso[0].variacion_mxn).toBe(4000);
  });

  it("top_exceso vacío cuando ninguna categoría excede", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [
        { categoria_presupuesto_id: "c1", total: 500, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-15" },
      ],
      error: null,
    });
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });

    const res = await fetchPresupuestoVsReal("2026-06");
    expect(res.categorias_en_exceso).toBe(0);
    expect(res.top_exceso).toEqual([]);
  });
});
