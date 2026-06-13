import { describe, it, expect, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchNbaSignals } from "../nbaSignals";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("fetchNbaSignals", () => {
  it("consulta crm_leads y crm_oportunidades en paralelo con filtros correctos", async () => {
    mock.setTableResult("crm_leads", {
      data: [{ id: "l1", empresa: "Acme", created_at: "2026-01-01" }],
      error: null,
    });
    mock.setTableResult("crm_oportunidades", {
      data: [
        {
          id: "o1",
          nombre: "Op 1",
          fecha_estimada_cierre: "2026-03-01",
          updated_at: "2026-02-01",
          crm_etapas_pipeline: { tipo: "abierta" },
        },
      ],
      error: null,
    });

    const res = await fetchNbaSignals();
    expect(res.leadsSinContactar).toHaveLength(1);
    expect(res.oportunidadesAbiertas[0]).toEqual({
      id: "o1",
      nombre: "Op 1",
      fecha_estimada_cierre: "2026-03-01",
      updated_at: "2026-02-01",
    });

    const leads = mock.tableCalls.find(c => c.table === "crm_leads");
    expect(leads?.ops).toContain("eq");
    expect(leads?.ops).toContain("lte");
    expect(leads?.ops).toContain("limit");
  });

  it("retorna arrays vacíos cuando no hay data", async () => {
    mock.setTableResult("crm_leads", { data: null, error: null });
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    const res = await fetchNbaSignals();
    expect(res.leadsSinContactar).toEqual([]);
    expect(res.oportunidadesAbiertas).toEqual([]);
  });

  it("propaga error de leads", async () => {
    mock.setTableResult("crm_leads", { data: null, error: new Error("leads down") });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    await expect(fetchNbaSignals()).rejects.toThrow("leads down");
  });

  it("propaga error de oportunidades", async () => {
    mock.setTableResult("crm_leads", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", { data: null, error: new Error("ops down") });
    await expect(fetchNbaSignals()).rejects.toThrow("ops down");
  });
});
