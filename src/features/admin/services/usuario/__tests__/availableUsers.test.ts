import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  const { vi: vitest } = await import("vitest");
  const invoke = vitest.fn().mockResolvedValue({
    data: [
      { id: "u1", email: "a@test.mx" },
      { id: "u2", email: "b@test.mx" },
    ],
    error: null,
  });
  return { ...createSupabaseMock(), invoke };
});
const invokeMock = mock.invoke;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { ...mock.supabase, functions: { invoke: mock.invoke } },
}));

import { fetchAvailableUsersSinMembresia } from "@/features/admin/services/usuario/availableUsers";

beforeEach(() => {
  mock.tableCalls.length = 0;
  invokeMock.mockClear();
});

describe("fetchAvailableUsersSinMembresia (Ola 4 · N27)", () => {
  it("excluye usuarios que ya tienen membresía en alguna organización", async () => {
    mock.setTableResult("organization_members", {
      data: [{ user_id: "u1" }],
      error: null,
    });
    const out = await fetchAvailableUsersSinMembresia();
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("u2");
  });

  it("propaga error al leer organization_members", async () => {
    mock.setTableResult("organization_members", { data: null, error: { message: "boom" } });
    await expect(fetchAvailableUsersSinMembresia()).rejects.toThrow();
  });
});
