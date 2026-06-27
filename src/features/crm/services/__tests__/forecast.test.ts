import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/features/crm/domain/forecast", () => ({
  computeForecast: vi.fn((data) => ({ total: data.length, ponderado: 0, por_vendedor: [] })),
  computeReportesCRM: vi.fn(() => ({ leads: [], oportunidades: [], motivosPerdida: [] })),
}));

import { fetchEtapaTipos, fetchForecast, fetchReportesCRM } from "../forecast";

beforeEach(() => { 
  mock.tableCalls.length = 0; 
  mock.rpcCalls.length = 0;
});

describe("fetchEtapaTipos", () => {
  it("devuelve Map con id→tipo", async () => {
    mock.setTableResult("crm_etapas_pipeline", {
      data: [{ id: "e-1", tipo: "abierta" }, { id: "e-2", tipo: "ganada" }],
      error: null,
    });
    const m = await fetchEtapaTipos();
    expect(m.get("e-1")).toBe("abierta");
    expect(m.get("e-2")).toBe("ganada");
  });

  it("maneja data null devolviendo Map vacío", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: null });
    const m = await fetchEtapaTipos();
    expect(m.size).toBe(0);
  });

  it("propaga error supabase en fetchEtapaTipos", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: { message: "err" } });
    await expect(fetchEtapaTipos()).rejects.toThrow("err");
  });
});

describe("fetchForecast", () => {
  it("aplica filtros de fecha si se proveen", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", { data: [{}, {}], error: null });
    
    const r = await fetchForecast("2024-01-01", "2024-12-31");
    expect(r.total).toBe(2);
    expect(r.por_vendedor).toEqual([]);
    
    const call = mock.tableCalls.find(c => c.table === "crm_oportunidades");
    expect(call?.ops).toContain("gte");
    expect(call?.ops).toContain("lte");
  });

  it("lanza error si falla la consulta de oportunidades", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", { data: null, error: { message: "op fail" } });
    await expect(fetchForecast()).rejects.toThrow("op fail");
  });
});

describe("fetchReportesCRM", () => {
  it("lanza error si falla cualquiera de las consultas", async () => {
    mock.setTableResult("crm_leads", { data: null, error: { message: "leads fail" } });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    mock.setTableResult("crm_motivos_perdida", { data: [], error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: [], error: null });
    
    await expect(fetchReportesCRM()).rejects.toThrow("leads fail");
  });

  it("maneja data null en todas las tablas", async () => {
    mock.setTableResult("crm_leads", { data: null, error: null });
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    mock.setTableResult("crm_motivos_perdida", { data: null, error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: null });
    
    const r = await fetchReportesCRM();
    expect(r).toBeDefined();
  });
});
