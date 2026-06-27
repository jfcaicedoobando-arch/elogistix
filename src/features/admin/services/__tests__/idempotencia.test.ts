import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listIdempotencyLog } from "@/features/admin/services/idempotencia";

describe("listIdempotencyLog", () => {
  beforeEach(() => {
    mock.rpcCalls.length = 0;
    mock.tableCalls.length = 0;
  });


  it("invoca la RPC con limit/offset y devuelve filas casteadas", async () => {
    const rows = [
      { key: "abc", fn: "create-user", hits: 1, created_at: "2026-05-01T00:00:00Z",
        user_id: "u1", user_email: "u1@x.com", has_response: true, pending: false },
    ];
    mock.setRpcResult("list_idempotency_log", { data: rows, error: null });
    const result = await listIdempotencyLog(50, 10);
    expect(result).toEqual(rows);
    expect(mock.rpcCalls.at(-1)).toEqual({
      fn: "list_idempotency_log",
      args: { _limit: 50, _offset: 10 },
    });
  });

  it("usa defaults limit=200 offset=0", async () => {
    mock.setRpcResult("list_idempotency_log", { data: [], error: null });
    await listIdempotencyLog();
    expect(mock.rpcCalls.at(-1)?.args).toEqual({ _limit: 200, _offset: 0 });
  });

  it("propaga errores de la RPC", async () => {
    mock.setRpcResult("list_idempotency_log", { data: null, error: new Error("boom") });
    await expect(listIdempotencyLog()).rejects.toThrow("boom");
  });

  it("devuelve [] si data viene null", async () => {
    mock.setRpcResult("list_idempotency_log", { data: null, error: null });
    const r = await listIdempotencyLog();
    expect(r).toEqual([]);
  });
});
