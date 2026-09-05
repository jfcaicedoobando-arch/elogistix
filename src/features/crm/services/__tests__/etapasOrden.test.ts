/**
 * Regresión de servicio: el intercambio de orden se hace con una sola RPC
 * atómica (`crm_intercambiar_orden_etapas`), nunca con UPDATEs sueltos que
 * podrían dejar dos etapas con el mismo orden.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { intercambiarOrdenEtapas } from "@/features/crm/services/etapas";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("intercambiarOrdenEtapas", () => {
  it("llama la RPC con ambas etapas y no hace UPDATE directo", async () => {
    mock.setRpcResult("crm_intercambiar_orden_etapas", { data: null, error: null });
    await intercambiarOrdenEtapas({ etapaA: "e2", etapaB: "e1" });
    expect(mock.rpcCalls).toHaveLength(1);
    expect(mock.rpcCalls[0]).toEqual({
      fn: "crm_intercambiar_orden_etapas",
      args: { p_etapa_a: "e2", p_etapa_b: "e1" },
    });
    expect(mock.tableCalls.some((c) => c.table === "crm_etapas_pipeline")).toBe(false);
  });

  it("propaga el error de la RPC", async () => {
    mock.setRpcResult("crm_intercambiar_orden_etapas", { data: null, error: { message: "boom" } });
    await expect(intercambiarOrdenEtapas({ etapaA: "e1", etapaB: "e2" })).rejects.toThrow();
  });
});
