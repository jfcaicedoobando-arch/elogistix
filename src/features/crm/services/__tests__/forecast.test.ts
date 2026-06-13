import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/features/crm/domain/forecast", () => ({
  computeForecast: vi.fn(() => ({ total: 0, ponderado: 0, por_vendedor: [] })),
  computeReportesCRM: vi.fn(() => ({ leads: [], oportunidades: [], motivosPerdida: [] })),
}));

import { fetchEtapaTipos, fetchForecast, fetchReportesCRM } from "../forecast";

beforeEach(() => { mock.tableCalls.length = 0; });

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

  it("propaga error supabase al calcular forecast", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: { message: "err" } });
    await expect(fetchEtapaTipos()).rejects.toBeTruthy();
  });
});

describe("fetchForecast", () => {
  it("llama computeForecast y devuelve resultado", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    const r = await fetchForecast();
    expect(r).toMatchObject({ total: 0 });
  });
});

describe("fetchReportesCRM", () => {
  it("llama computeReportesCRM con las cuatro tablas", async () => {
    mock.setTableResult("crm_leads", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    mock.setTableResult("crm_motivos_perdida", { data: [], error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: [], error: null });
    const r = await fetchReportesCRM();
    expect(r).toMatchObject({ leads: [] });
  });
});
