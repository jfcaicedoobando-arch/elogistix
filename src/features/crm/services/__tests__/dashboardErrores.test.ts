/**
 * Auditoría CRM — fetchCrmDashboard no debe silenciar errores de Supabase:
 * un fallo en cualquiera de las 7 consultas rechaza la promesa (el tablero
 * muestra estado de error/reintento) en vez de pintar ceros creíbles.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

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

describe("fetchCrmDashboard — propagación de errores", () => {
  it("rechaza cuando falla una consulta de conteo", async () => {
    mock.setTableResult("crm_actividades", {
      data: null,
      error: { message: "RLS denegado" },
      count: null,
    } as never);
    await expect(fetchCrmDashboard("agente-1", "agente1@x.com")).rejects.toMatchObject({
      message: "RLS denegado",
    });
  });

  it("rechaza cuando falla la consulta paginada de oportunidades abiertas", async () => {
    mock.setTableResult("crm_oportunidades", {
      data: null,
      error: { message: "red caída" },
    });
    await expect(fetchCrmDashboard("agente-1", "agente1@x.com")).rejects.toMatchObject({
      message: "red caída",
    });
  });

  it("devuelve las métricas actuales cuando no hay error", async () => {
    mock.setTableResult("crm_leads", { data: [], error: null, count: 3 } as never);
    const data = await fetchCrmDashboard("agente-1", "agente1@x.com");
    expect(data.kpis.leads).toBe(3);
  });
});
