import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { insertLoginAudit } from "../loginAudit";

beforeEach(() => { mock.tableCalls.length = 0; });

describe("insertLoginAudit", () => {
  it("inserta en bitacora_actividad con los campos correctos", async () => {
    mock.setTableResult("bitacora_actividad", { data: {}, error: null });
    await insertLoginAudit("user-1", "a@test.com");
    expect(mock.tableCalls[0]?.table).toBe("bitacora_actividad");
    expect(mock.tableCalls[0]?.ops).toContain("insert");
  });

  it("no lanza aunque supabase devuelva error (silent audit)", async () => {
    mock.setTableResult("bitacora_actividad", { data: null, error: { message: "db down" } });
    await expect(insertLoginAudit("user-2", "b@test.com")).resolves.toBeUndefined();
  });

  it("no lanza aunque supabase lance excepción", async () => {
    mock.supabase.from.mockImplementationOnce(() => { throw new Error("network"); });
    await expect(insertLoginAudit("user-3", "c@test.com")).resolves.toBeUndefined();
  });
});
