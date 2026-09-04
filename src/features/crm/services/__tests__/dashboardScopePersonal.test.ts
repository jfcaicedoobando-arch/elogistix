/**
 * Tanda 2 · hallazgo 1: las tarjetas rotuladas como personales en "Mi día"
 * deben filtrar por el usuario autenticado (id, o correo legado cuando el id
 * es null). Las tarjetas de equipo (KPIs) conservan su semántica global.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchCrmDashboard } from "../dashboard";

/** Expresiones `.or()` aplicadas a una tabla. */
function expresionesOr(tabla: string): string[] {
  return mock.tableCalls
    .filter((c) => c.table === tabla)
    .flatMap((c) =>
      c.ops.flatMap((op, i) => (op === "or" ? [String(c.opArgs[i][0])] : [])),
    );
}

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
  mock.setTableResult("crm_leads", { data: [], error: null, count: 0 } as never);
  mock.setTableResult("crm_oportunidades", { data: [], error: null });
  mock.setTableResult("crm_actividades", { data: [], error: null, count: 0 } as never);
  mock.setTableResult("crm_etapas_pipeline", { data: [], error: null });
});

describe("fetchCrmDashboard — alcance personal", () => {
  it("filtra actividades de hoy por responsable (id o correo legado)", async () => {
    await fetchCrmDashboard("agente-1", "agente1@x.com");
    expect(expresionesOr("crm_actividades")).toContain(
      "responsable_id.eq.agente-1,and(responsable_id.is.null,responsable_email.eq.agente1@x.com)",
    );
  });

  it("filtra 'Cerrando esta semana' y 'Leads sin contactar' por vendedor", async () => {
    await fetchCrmDashboard("agente-1", "agente1@x.com");
    const esperado =
      "vendedor_id.eq.agente-1,and(vendedor_id.is.null,vendedor_email.eq.agente1@x.com)";
    expect(expresionesOr("crm_oportunidades")).toContain(esperado);
    expect(expresionesOr("crm_leads")).toContain(esperado);
  });

  it("un agente nunca pide registros de otro agente", async () => {
    await fetchCrmDashboard("agente-2", "agente2@x.com");
    const todas = [
      ...expresionesOr("crm_oportunidades"),
      ...expresionesOr("crm_leads"),
      ...expresionesOr("crm_actividades"),
    ];
    expect(todas.length).toBeGreaterThan(0);
    for (const expr of todas) {
      expect(expr).toContain("agente-2");
      expect(expr).not.toContain("agente-1");
    }
  });

  it("sin usuario devuelve listas personales vacías (no datos ajenos)", async () => {
    const data = await fetchCrmDashboard(undefined, null);
    expect(data.misActividadesHoy).toEqual([]);
    expect(data.cerrandoEstaSemana).toEqual([]);
    expect(data.leadsSinContactar).toEqual([]);
    expect(expresionesOr("crm_oportunidades")).toEqual([]);
  });
});
