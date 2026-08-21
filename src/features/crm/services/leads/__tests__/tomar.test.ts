import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { tomarLead } from "../mutations";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("tomarLead (Ola 6 · O6.1)", () => {
  it("invoca crm_tomar_lead con el id del lead", async () => {
    mock.setRpcResult("crm_tomar_lead", {
      data: { lead_id: "lead-1", vendedor_id: "usr-1", tomado: true },
      error: null,
    });

    await tomarLead("lead-1", "Beta SA");

    const call = mock.rpcCalls.find((c) => c.fn === "crm_tomar_lead");
    expect(call?.args).toEqual({ p_lead_id: "lead-1" });
  });

  it("propaga el error de la RPC (p.ej. LC_LEAD_YA_ASIGNADO)", async () => {
    mock.setRpcResult("crm_tomar_lead", { data: null, error: { message: "LC_LEAD_YA_ASIGNADO" } });
    await expect(tomarLead("lead-1", "Beta SA")).rejects.toThrow(/LC_LEAD_YA_ASIGNADO/);
  });
});
