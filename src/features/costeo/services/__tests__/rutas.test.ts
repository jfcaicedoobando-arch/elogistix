import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  CosteoRutaDuplicadaError,
  fetchCosteoRutas,
  insertCosteoRuta,
  deleteCosteoRuta,
} from "../rutas";

const ORG = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("costeo/services/rutas", () => {
  it("fetchCosteoRutas aplana puerto_origen/destino a nombres", async () => {
    mock.setTableResult("costeo_rutas", {
      data: [
        {
          id: "r1",
          puerto_origen_id: "po",
          puerto_destino_id: "pd",
          puerto_origen: { name: "Shanghai" },
          puerto_destino: { name: "Manzanillo" },
          costeo_tarifas: [],
        },
      ],
      error: null,
    });
    const res = await fetchCosteoRutas(ORG);
    expect(res[0].puerto_origen_nombre).toBe("Shanghai");
    expect(res[0].puerto_destino_nombre).toBe("Manzanillo");
    expect(res[0].tarifas_vigentes_count).toBe(0);
    expect(res[0].proveedores_count).toBe(0);
  });

  it("fetchCosteoRutas agrega conteos de tarifas vigentes y proveedores", async () => {
    const futura = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const pasada = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    mock.setTableResult("costeo_rutas", {
      data: [
        {
          id: "r1",
          puerto_origen_id: "po",
          puerto_destino_id: "pd",
          activa: true,
          puerto_origen: { name: "Ningbo" },
          puerto_destino: { name: "Lázaro Cárdenas" },
          costeo_tarifas: [
            { estado: "vigente", vigente_hasta: futura, updated_at: "2026-06-10T00:00:00Z", agente_id: "a1" },
            { estado: "vigente", vigente_hasta: futura, updated_at: "2026-06-15T00:00:00Z", agente_id: "a2" },
            { estado: "vencida", vigente_hasta: pasada, updated_at: "2026-01-01T00:00:00Z", agente_id: "a3" },
            { estado: "vigente", vigente_hasta: pasada, updated_at: "2026-01-01T00:00:00Z", agente_id: "a4" },
          ],
        },
      ],
      error: null,
    });
    const [ruta] = await fetchCosteoRutas(ORG);
    expect(ruta.tarifas_vigentes_count).toBe(2);
    expect(ruta.proveedores_count).toBe(2);
    expect(ruta.proxima_expiracion).toBe(futura);
    expect(ruta.ultima_actualizacion_tarifa).toBe("2026-06-15T00:00:00Z");
  });



  it("insertCosteoRuta incluye organization_id en el payload", async () => {
    mock.setTableResult("costeo_rutas", { data: { id: "r2" }, error: null });
    await insertCosteoRuta(ORG, { puerto_origen_id: "po", puerto_destino_id: "pd" });
    const payload = mock.getMutationPayload("costeo_rutas", "insert") as Record<string, unknown>;
    expect(payload.organization_id).toBe(ORG);
    expect(payload.puerto_origen_id).toBe("po");
  });

  it("insertCosteoRuta traduce duplicados a error de negocio", async () => {
    mock.setTableResult("costeo_rutas", {
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    await expect(insertCosteoRuta(ORG, { puerto_origen_id: "po", puerto_destino_id: "pd" }))
      .rejects.toBeInstanceOf(CosteoRutaDuplicadaError);
  });

  it("insertCosteoRuta traduce duplicado aunque el constraint name difiera", async () => {
    mock.setTableResult("costeo_rutas", {
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint \"costeo_rutas_pkey_v2\"" },
    });
    await expect(insertCosteoRuta(ORG, { puerto_origen_id: "po", puerto_destino_id: "pd" }))
      .rejects.toBeInstanceOf(CosteoRutaDuplicadaError);
  });

  it("deleteCosteoRuta usa delete().eq('id', ...)", async () => {
    mock.setTableResult("costeo_rutas", { data: null, error: null });
    await deleteCosteoRuta("r1");
    const call = mock.tableCalls.find((c) => c.table === "costeo_rutas");
    expect(call?.ops).toContain("delete");
  });
});
