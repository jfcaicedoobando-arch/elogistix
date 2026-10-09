import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listTrash, restoreRecord, purgeRecord } from "@/features/admin/services/papelera";

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
    await expect(listTrash("clientes")).rejects.toThrow();
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
    await expect(restoreRecord("facturas", "f1")).rejects.toThrow();
  });

  it("purgeRecord llama purge_record", async () => {
    mock.setRpcResult("purge_record", { data: null, error: null });
    await purgeRecord("embarques", "e1");
    expect(mock.rpcCalls[0].fn).toBe("purge_record");
  });

  it("purgeRecord propaga error", async () => {
    mock.setRpcResult("purge_record", { data: null, error: { message: "x" } });
    await expect(purgeRecord("embarques", "e1")).rejects.toThrow();
  });
});

describe("contrato de Papelera para seguros", () => {
  it("mantiene la póliza y el actor desconocido nulo al listar y restaurar su id", async () => {
    const policy = { id: "policy-a", organization_id: "org-a", deleted_at: "2026-10-08T12:00:00Z", deleted_by: null, deleted_by_email: null, label: "POL-42" };
    mock.setRpcResult("list_trash", { data: [policy], error: null });
    mock.setRpcResult("restore_record", { data: null, error: null });
    const rows = await listTrash("seguros_embarque", 50, 0);
    expect(rows).toEqual([policy]);
    expect(rows[0].deleted_by).toBeNull();
    expect(rows[0].deleted_by_email).toBeNull();
    await restoreRecord("seguros_embarque", rows[0].id);
    expect(mock.rpcCalls.map(({ fn, args }) => ({ fn, args }))).toEqual([
      { fn: "list_trash", args: { _table: "seguros_embarque", _limit: 50, _offset: 0 } },
      { fn: "restore_record", args: { _table: "seguros_embarque", _id: "policy-a" } },
    ]);
  });
  it.each(["LC_SEGURO_COBERTURA_INCOMPLETA", "LC_ORG_FUERA_DE_SCOPE", "ux_seguros_embarque_factura_activa"])("propaga %s sin simular éxito", async (message) => {
    const error = new Error(message);
    mock.setRpcResult("restore_record", { data: null, error });
    await expect(restoreRecord("seguros_embarque", "policy-a")).rejects.toBe(error);
    expect(mock.rpcCalls).toHaveLength(1);
  });
});
