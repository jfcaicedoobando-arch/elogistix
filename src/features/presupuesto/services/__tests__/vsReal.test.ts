import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

vi.mock("../categorias", () => ({
  fetchCategorias: vi.fn().mockResolvedValue([{ id: "c1", nombre: "Comisiones" }])
}));
vi.mock("../mensual", () => ({
  fetchPresupuestoMensualAnio: vi.fn().mockResolvedValue([{ categoria_id: "c1", periodo: "2024-01", monto_mxn: 1000 }])
}));

import { fetchPresupuestoVsReal } from "../vsReal";

describe("vsReal presupuesto service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchPresupuestoVsReal consolida datos de CxP y Liquidaciones", async () => {
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    mock.setTableResult("liquidaciones_comision", { data: [{ total_mxn: 500, periodo: "2024-01" }], error: null });
    
    const res = await fetchPresupuestoVsReal("2024-01");
    expect(res.filas[0].presupuesto_mxn).toBe(1000);
    expect(res.filas[0].real_mxn).toBe(500); // de liquidaciones mapeadas a "Comisiones"
    expect(res.total_real_mxn).toBe(500);
  });

  it("lanza error si falla la query de CxP", async () => {
    mock.setTableResult("proveedor_facturas", { data: null, error: new Error("db error") });
    await expect(fetchPresupuestoVsReal("2024-01")).rejects.toThrow("db error");
  });
});
