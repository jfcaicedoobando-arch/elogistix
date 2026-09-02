import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { insertLoginAudit } from "../loginAudit";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.supabase.rpc.mockClear();
});

describe("insertLoginAudit", () => {
  // DEFECTO 8: la bitácora se escribe por RPC, no con un INSERT del navegador.
  it("registra el login por la RPC registrar_bitacora", async () => {
    await insertLoginAudit("user-1", "a@test.com");
    expect(mock.supabase.rpc).toHaveBeenCalledWith("registrar_bitacora", {
      p_modulo: "auth",
      p_accion: "login",
      p_entidad_nombre: "a@test.com",
    });
  });

  it("no lanza aunque supabase devuelva error (silent audit)", async () => {
    mock.supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "db down" } });
    await expect(insertLoginAudit("user-2", "b@test.com")).resolves.toBeUndefined();
  });

  it("no lanza aunque supabase lance excepción", async () => {
    mock.supabase.rpc.mockImplementationOnce(() => { throw new Error("network"); });
    await expect(insertLoginAudit("user-3", "c@test.com")).resolves.toBeUndefined();
  });
});
