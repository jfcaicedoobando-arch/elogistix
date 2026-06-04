import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

vi.mock("@/services/admin/members", () => ({
  fetchAvailableUsers: vi.fn().mockResolvedValue([{ id: "u1", email: "u1@test.com" }])
}));

import { fetchVendedorasConfig, upsertVendedoraConfig, fetchUsuariosVendedores } from "../vendedoras";

describe("vendedoras service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchVendedorasConfig mezcla con emails de usuarios", async () => {
    mock.setTableResult("vendedora_config", { data: [{ user_id: "u1", porc_comision: 5 }], error: null });
    const res = await fetchVendedorasConfig();
    expect(res[0].email).toBe("u1@test.com");
  });

  it("upsertVendedoraConfig hace upsert", async () => {
    mock.setTableResult("vendedora_config", { data: [], error: null });
    await upsertVendedoraConfig({ organization_id: "o1", user_id: "u1", porc_comision: 5 } as any);
    const call = mock.tableCalls.find(c => c.table === "vendedora_config");
    expect(call?.ops).toContain("upsert");
  });

  it("fetchUsuariosVendedores filtra por rol", async () => {
    mock.setTableResult("organization_members", { 
      data: [{ user_id: "u1", role: "vendedor" }, { user_id: "u2", role: "usuario" }], 
      error: null 
    });
    const res = await fetchUsuariosVendedores();
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("u1");
  });
});
