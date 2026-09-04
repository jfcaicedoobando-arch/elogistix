/**
 * Auditoría CRM v13.823.75 · hallazgo 5 — el KPI "Leads" del Resumen ejecutivo
 * contaba prospectos y convertidos (decía 3) mientras /crm/leads mostraba "2
 * leads en cartera". Semántica única: cartera activa (etapa Lead).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { LEAD_ESTADOS_ETAPA_LEAD } from "@/features/crm/domain/leads/etapas";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchCrmDashboard } from "../dashboard";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
  mock.setTableResult("crm_leads", { data: [], error: null, count: 0 } as never);
  mock.setTableResult("crm_oportunidades", { data: [], error: null });
  mock.setTableResult("crm_actividades", { data: [], error: null, count: 0 } as never);
  mock.setTableResult("crm_etapas_pipeline", { data: [], error: null });
});

describe("fetchCrmDashboard — KPI de leads en cartera", () => {
  it("restringe el conteo a los estados de etapa Lead", async () => {
    await fetchCrmDashboard("agente-1", "agente1@x.com");
    const filtrosIn = mock.tableCalls
      .filter((c) => c.table === "crm_leads")
      .flatMap((c) => c.ops.flatMap((op, i) => (op === "in" ? [c.opArgs[i]] : [])));
    expect(filtrosIn).toContainEqual(["estado", LEAD_ESTADOS_ETAPA_LEAD]);
  });
});
