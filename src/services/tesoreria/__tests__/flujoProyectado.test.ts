import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

// Mocks de dependencias de servicios
vi.mock("@/services/facturas", () => ({ fetchCobranza: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/cxp", () => ({ fetchFacturasCxP: vi.fn().mockResolvedValue([]) }));
vi.mock("../resumen", () => ({ fetchResumenTesoreria: vi.fn().mockResolvedValue({ cuentas: [] }) }));

import { fetchFlujoProyectado } from "../flujoProyectado";

describe("flujoProyectado service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchFlujoProyectado retorna estructura base", async () => {
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });
    const res = await fetchFlujoProyectado(30);
    expect(res).toHaveProperty("saldo_inicial_mxn");
    expect(res.semanas.length).toBeGreaterThan(0);
  });

  it("maneja error de liquidaciones retornando lista vacia por catch interno", async () => {
    mock.setTableResult("liquidaciones_comision", { data: null, error: new Error("db error") });
    const res = await fetchFlujoProyectado(30);
    expect(res).toBeDefined();
    expect(res.total_salidas_mxn).toBe(0);
  });
});
