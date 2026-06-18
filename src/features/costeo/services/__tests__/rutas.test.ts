import { describe, it, expect, beforeEach } from "vitest";

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
        },
      ],
      error: null,
    });
    const res = await fetchCosteoRutas(ORG);
    expect(res[0].puerto_origen_nombre).toBe("Shanghai");
    expect(res[0].puerto_destino_nombre).toBe("Manzanillo");
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

  it("deleteCosteoRuta usa delete().eq('id', ...)", async () => {
    mock.setTableResult("costeo_rutas", { data: null, error: null });
    await deleteCosteoRuta("r1");
    const call = mock.tableCalls.find((c) => c.table === "costeo_rutas");
    expect(call?.ops).toContain("delete");
  });
});
