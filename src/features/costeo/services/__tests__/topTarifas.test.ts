import { describe, it, expect, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchTopTarifas, fetchRecargosDeTarifa } from "../topTarifas";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("costeo/services/topTarifas", () => {
  it("fetchTopTarifas invoca RPC get_top_tarifas con parámetros mapeados", async () => {
    mock.setRpcResult("get_top_tarifas", {
      data: [{ tarifa_id: "t1", total_usd: 1000 }],
      error: null,
    });
    const res = await fetchTopTarifas({
      puertoOrigenId: "po",
      puertoDestinoId: "pd",
      tipoContenedorId: "tc",
      fecha: "2026-06-12",
      organizationId: "org-1",
    });
    expect(mock.rpcCalls[0].fn).toBe("get_top_tarifas");
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_puerto_origen_id).toBe("po");
    expect(args.p_fecha).toBe("2026-06-12");
    expect(args.p_organization_id).toBe("org-1");
    expect(res).toHaveLength(1);
  });

  it("fetchTopTarifas usa fecha de hoy si no se provee", async () => {
    mock.setRpcResult("get_top_tarifas", { data: [], error: null });
    await fetchTopTarifas({ puertoOrigenId: "po", puertoDestinoId: "pd", tipoContenedorId: "tc" });
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("fetchRecargosDeTarifa filtra por tarifa_id y ordena por concepto", async () => {
    mock.setTableResult("costeo_tarifa_recargos", { data: [{ id: "r1", concepto: "BAF" }], error: null });
    const res = await fetchRecargosDeTarifa("t1");
    const call = mock.tableCalls.find((c) => c.table === "costeo_tarifa_recargos");
    expect(call?.ops).toContain("eq");
    expect(call?.ops).toContain("order");
    expect(res[0].concepto).toBe("BAF");
  });
});
