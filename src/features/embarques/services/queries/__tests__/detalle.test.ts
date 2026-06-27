/**
 * Tests for src/services/embarque/queries/detalle.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchEmbarqueById, fetchEmbarqueFull } from "@/features/embarques/services/queries/detalle";

const UUID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("fetchEmbarqueById", () => {
  it("queries embarques table with .single() using the given id", async () => {
    const row = { id: UUID, expediente: "EXP-001" };
    mock.setTableResult("embarques", { data: row, error: null });
    const result = await fetchEmbarqueById(UUID);
    expect(result).toMatchObject({ id: UUID });
    const call = mock.tableCalls.find((c) => c.table === "embarques");
    expect(call?.ops).toEqual(expect.arrayContaining(["select", "eq"]));
  });

  it("throws when fetchEmbarqueById supabase errors", async () => {
    mock.setTableResult("embarques", { data: null, error: new Error("not found") });
    await expect(fetchEmbarqueById(UUID)).rejects.toThrow("not found");
  });
});

describe("fetchEmbarqueFull", () => {
  it("calls get_embarque_full RPC directly for a valid UUID", async () => {
    const payload = {
      embarque: { id: UUID, expediente: "EXP-001" },
      conceptosVenta: [],
      conceptosCosto: [],
      documentos: [],
      notas: [],
      facturas: [],
    };
    mock.setRpcResult("get_embarque_full", { data: payload, error: null });
    const result = await fetchEmbarqueFull(UUID);
    expect(result?.embarque).toMatchObject({ id: UUID });
    expect(result?.conceptosVenta).toEqual([]);
    const call = mock.rpcCalls.find((c) => c.fn === "get_embarque_full");
    expect(call).toBeDefined();
    expect((call?.args as { p_embarque_id: string }).p_embarque_id).toBe(UUID);
  });

  it("resolves expediente string via table lookup before calling RPC", async () => {
    mock.setTableResult("embarques", { data: { id: UUID }, error: null });
    mock.setRpcResult("get_embarque_full", {
      data: { embarque: { id: UUID }, conceptosVenta: null, conceptosCosto: null, documentos: null, notas: null, facturas: null },
      error: null,
    });
    const result = await fetchEmbarqueFull("EXP-NOT-UUID");
    expect(result?.embarque).toMatchObject({ id: UUID });
  });

  it("returns null when expediente lookup finds no row", async () => {
    mock.setTableResult("embarques", { data: null, error: null });
    const result = await fetchEmbarqueFull("EXP-MISSING");
    expect(result).toBeNull();
  });

  it("returns null when RPC returns null data", async () => {
    mock.setRpcResult("get_embarque_full", { data: null, error: null });
    const result = await fetchEmbarqueFull(UUID);
    expect(result).toBeNull();
  });

  it("defaults null arrays to empty arrays in result", async () => {
    mock.setRpcResult("get_embarque_full", {
      data: { embarque: { id: UUID }, conceptosVenta: null, conceptosCosto: null, documentos: null, notas: null, facturas: null },
      error: null,
    });
    const result = await fetchEmbarqueFull(UUID);
    expect(result?.conceptosVenta).toEqual([]);
    expect(result?.documentos).toEqual([]);
    expect(result?.facturas).toEqual([]);
  });

  it("throws when fetchEmbarqueFull RPC errors", async () => {
    mock.setRpcResult("get_embarque_full", { data: null, error: new Error("rpc fail") });
    await expect(fetchEmbarqueFull(UUID)).rejects.toThrow("rpc fail");
  });
});
