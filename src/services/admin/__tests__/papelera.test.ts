import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listTrash, restoreRecord, purgeRecord } from "@/services/admin/papelera";

beforeEach(() => {
  mock.rpcCalls.length = 0;
});

describe("services/admin/papelera", () => {
  it("listTrash llama list_trash con defaults", async () => {
    mock.setRpcResult("list_trash", { data: [{ id: "1" }], error: null });
    const r = await listTrash("clientes");
    expect(r).toEqual([{ id: "1" }]);
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args._table).toBe("clientes");
    expect(args._limit).toBe(200);
    expect(args._offset).toBe(0);
  });

  it("listTrash respeta limit/offset", async () => {
    mock.setRpcResult("list_trash", { data: [], error: null });
    await listTrash("facturas", 50, 100);
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args._limit).toBe(50);
    expect(args._offset).toBe(100);
  });

  it("listTrash devuelve [] cuando data null", async () => {
    mock.setRpcResult("list_trash", { data: null, error: null });
    const r = await listTrash("embarques");
    expect(r).toEqual([]);
  });

  it("listTrash propaga error", async () => {
    mock.setRpcResult("list_trash", { data: null, error: { message: "x" } });
    await expect(listTrash("clientes")).rejects.toBeTruthy();
  });

  it("restoreRecord llama restore_record", async () => {
    mock.setRpcResult("restore_record", { data: null, error: null });
    await restoreRecord("facturas", "f1");
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args._table).toBe("facturas");
    expect(args._id).toBe("f1");
  });

  it("restoreRecord propaga error", async () => {
    mock.setRpcResult("restore_record", { data: null, error: { message: "x" } });
    await expect(restoreRecord("facturas", "f1")).rejects.toBeTruthy();
  });

  it("purgeRecord llama purge_record", async () => {
    mock.setRpcResult("purge_record", { data: null, error: null });
    await purgeRecord("embarques", "e1");
    expect(mock.rpcCalls[0].fn).toBe("purge_record");
  });

  it("purgeRecord propaga error", async () => {
    mock.setRpcResult("purge_record", { data: null, error: { message: "x" } });
    await expect(purgeRecord("embarques", "e1")).rejects.toBeTruthy();
  });
});
