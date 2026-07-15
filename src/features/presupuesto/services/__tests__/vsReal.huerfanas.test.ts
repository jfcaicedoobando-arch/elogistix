/**
 * Fase 3 — gasto real con categoría inactiva/eliminada NO debe desaparecer.
 * Debe aparecer en fila sintética "Sin categoría / inactivas".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

// Sólo devuelve "Fletes" — cualquier gasto con otra categoría es huérfano.
vi.mock("../categorias", () => ({
  fetchCategorias: vi.fn().mockResolvedValue([{ id: "cat-fletes", nombre: "Fletes" }]),
}));
vi.mock("../mensual", () => ({
  fetchPresupuestoMensualAnio: vi.fn().mockResolvedValue([]),
}));

import { fetchPresupuestoVsReal } from "../vsReal";

describe("fetchPresupuestoVsReal — categorías huérfanas (Fase 3)", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });
  });

  it("gasto con categoría inactiva se recupera en fila '__huerfanas__'", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [
        { categoria_presupuesto_id: "cat-inactiva", total: 1234, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-01" },
        { categoria_presupuesto_id: "cat-fletes", total: 500, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-05" },
      ],
      error: null,
    });
    const res = await fetchPresupuestoVsReal("2026-06", "org-1");
    const huerfanas = res.filas.find((f) => f.categoria_id === "__huerfanas__");
    expect(huerfanas).toBeDefined();
    expect(huerfanas!.real_mxn).toBe(1234);
    expect(res.total_real_mxn).toBe(1734);
  });

  it("sin huérfanos NO agrega la fila sintética", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [
        { categoria_presupuesto_id: "cat-fletes", total: 500, moneda: "MXN", tipo_cambio_usd: null, fecha_emision: "2026-06-05" },
      ],
      error: null,
    });
    const res = await fetchPresupuestoVsReal("2026-06", "org-1");
    expect(res.filas.find((f) => f.categoria_id === "__huerfanas__")).toBeUndefined();
  });
});
