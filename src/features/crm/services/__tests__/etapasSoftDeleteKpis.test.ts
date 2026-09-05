/**
 * Auditoría CRM: una oportunidad ligada a una etapa eliminada (soft-delete) no
 * debe seguir sumando en KPIs/forecast, porque esa etapa ya no existe en el
 * embudo ni en configuración.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchCrmDashboard } from "../dashboard";
import { fetchEtapaTipos, fetchForecast } from "../forecast";
import { computeForecast } from "@/features/crm/domain/forecast";

/** Filtros `.is()` aplicados a una tabla dentro de las llamadas registradas. */
function filtrosIs(tabla: string): Array<[string, unknown]> {
  return mock.tableCalls
    .filter((c) => c.table === tabla)
    .flatMap((c) =>
      c.ops.flatMap((op, i) =>
        op === "is" ? [[String(c.opArgs[i][0]), c.opArgs[i][1]] as [string, unknown]] : [],
      ),
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

describe("soft-delete de etapas en KPIs y forecast", () => {
  it("el dashboard excluye etapas eliminadas en el join de oportunidades", async () => {
    await fetchCrmDashboard("agente-1", "agente1@x.com");
    const filtros = filtrosIs("crm_oportunidades");
    const etapaBorrada = filtros.filter(
      ([col, val]) => col === "crm_etapas_pipeline.deleted_at" && val === null,
    );
    // Pipeline/KPI + tarjeta personal "Cerrando esta semana".
    expect(etapaBorrada.length).toBeGreaterThanOrEqual(2);
  });

  it("fetchEtapaTipos ignora etapas eliminadas", async () => {
    mock.setTableResult("crm_etapas_pipeline", {
      data: [{ id: "e-viva", tipo: "abierta" }],
      error: null,
    });
    const mapa = await fetchEtapaTipos();
    expect(mapa.get("e-viva")).toBe("abierta");
    expect(filtrosIs("crm_etapas_pipeline")).toContainEqual(["deleted_at", null]);
  });

  it("una oportunidad en etapa eliminada no suma pipeline ni ganado", async () => {
    // La etapa borrada no llega en el Map, así que la fila no se clasifica.
    mock.setTableResult("crm_etapas_pipeline", {
      data: [{ id: "e-viva", tipo: "abierta" }],
      error: null,
    });
    mock.setTableResult("crm_oportunidades", {
      data: [
        {
          id: "o-1",
          monto_estimado: 1000,
          probabilidad: 50,
          fecha_estimada_cierre: "2026-03-10",
          vendedor_email: "a@x.com",
          etapa_id: "e-viva",
          moneda: "MXN",
        },
        {
          id: "o-2",
          monto_estimado: 5000,
          probabilidad: 80,
          fecha_estimada_cierre: "2026-03-15",
          vendedor_email: "a@x.com",
          etapa_id: "e-borrada",
          moneda: "MXN",
        },
      ],
      error: null,
    });

    const resumen = await fetchForecast();
    const mxn = resumen.totalesPorMoneda.find((t) => t.moneda === "MXN");
    expect(mxn?.totalPipeline).toBe(1000);
    expect(mxn?.totalGanado).toBe(0);
    // El reporte sigue devolviendo la fila, sólo sin clasificar.
    expect(resumen.porVendedor.length).toBeGreaterThan(0);
  });

  it("computeForecast no cuenta filas cuyo tipo de etapa es desconocido", () => {
    const r = computeForecast(
      [
        {
          monto_estimado: 900,
          probabilidad: 100,
          fecha_estimada_cierre: "2026-01-05",
          vendedor_email: null,
          etapa_id: "e-borrada",
          moneda: "MXN",
        },
      ],
      new Map(),
    );
    const mxn = r.totalesPorMoneda.find((t) => t.moneda === "MXN");
    expect(mxn?.totalPipeline ?? 0).toBe(0);
    expect(mxn?.totalGanado ?? 0).toBe(0);
  });
});
