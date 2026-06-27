/**
 * Tests for src/services/embarque/queries/listado.ts
 * Covers fetchEmbarquesPaginados (paginados), fetchEmbarquesRelacionados and
 * fetchEmbarquesListExtras (extras).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchEmbarquesPaginados,
  fetchEmbarquesRelacionados,
  fetchEmbarquesListExtras,
} from "@/features/embarques/services/queries/listado";

const BASE_FILTERS = {
  organizationId: "org-1",
  search: "",
  filterModo: "todos",
  filterCliente: "todos",
  filterOperador: "todos",
  page: 0,
  pageSize: 20,
};

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("fetchEmbarquesPaginados (listado integration)", () => {
  it("calls embarques_listado RPC with pagination params", async () => {
    mock.setRpcResult("embarques_listado", { data: [], error: null });
    const result = await fetchEmbarquesPaginados(BASE_FILTERS);
    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
    const call = mock.rpcCalls.find((c) => c.fn === "embarques_listado");
    expect(call).toBeDefined();
    const args = call?.args as { p_limit: number; p_offset: number };
    expect(args.p_limit).toBe(20);
    expect(args.p_offset).toBe(0);
  });

  it("falls back to expediente_num sort when sortBy is invalid", async () => {
    mock.setRpcResult("embarques_listado", { data: [], error: null });
    await fetchEmbarquesPaginados({ ...BASE_FILTERS, sortBy: "invalid_col" as never });
    const call = mock.rpcCalls.find((c) => c.fn === "embarques_listado");
    const args = call?.args as { p_sort_by: string };
    expect(args.p_sort_by).toBe("expediente_num");
  });

  it("extracts total_count and extras from enriched rows", async () => {
    const row = {
      id: "r1",
      costos_total: "5000",
      costos_pagados: "2000",
      docs_total: "10",
      docs_pendientes: "3",
      total_count: "42",
    };
    mock.setRpcResult("embarques_listado", { data: [row], error: null });
    const result = await fetchEmbarquesPaginados(BASE_FILTERS);
    expect(result.count).toBe(42);
    expect(result.extras.liquidacion["r1"]).toEqual({ total: 5000, pagados: 2000 });
    expect(result.extras.docs["r1"]).toEqual({ total: 10, pendientes: 3 });
  });

  it("throws when fetchEmbarquesPaginados RPC errors", async () => {
    mock.setRpcResult("embarques_listado", { data: null, error: new Error("timeout") });
    await expect(fetchEmbarquesPaginados(BASE_FILTERS)).rejects.toThrow("timeout");
  });
});

describe("fetchEmbarquesRelacionados", () => {
  it("queries embarques filtered by bl_master", async () => {
    mock.setTableResult("embarques", { data: [], error: null });
    const result = await fetchEmbarquesRelacionados("emb-1", "BL-MASTER-123");
    expect(result).toEqual([]);
    const call = mock.tableCalls.find((c) => c.table === "embarques");
    expect(call?.ops).toEqual(expect.arrayContaining(["select", "eq", "order"]));
  });

  it("throws when fetchEmbarquesRelacionados supabase errors", async () => {
    mock.setTableResult("embarques", { data: null, error: new Error("bl error") });
    await expect(fetchEmbarquesRelacionados("emb-1", "BL-X")).rejects.toThrow("bl error");
  });
});

describe("fetchEmbarquesListExtras", () => {
  it("returns empty extras when ids array is empty", async () => {
    const result = await fetchEmbarquesListExtras([]);
    expect(result).toEqual({ liquidacion: {}, docs: {} });
  });

  it("calls embarques_list_extras RPC with p_ids", async () => {
    mock.setRpcResult("embarques_list_extras", { data: [], error: null });
    const result = await fetchEmbarquesListExtras(["id1", "id2"]);
    expect(result.liquidacion).toEqual({});
    const call = mock.rpcCalls.find((c) => c.fn === "embarques_list_extras");
    expect(call).toBeDefined();
    expect((call?.args as { p_ids: string[] }).p_ids).toEqual(["id1", "id2"]);
  });

  it("maps RPC rows into liquidacion and docs objects", async () => {
    const rows = [
      { embarque_id: "e1", costos_total: 1000, costos_pagados: 500, docs_total: 5, docs_pendientes: 2 },
    ];
    mock.setRpcResult("embarques_list_extras", { data: rows, error: null });
    const result = await fetchEmbarquesListExtras(["e1"]);
    expect(result.liquidacion["e1"]).toEqual({ total: 1000, pagados: 500 });
    expect(result.docs["e1"]).toEqual({ total: 5, pendientes: 2 });
  });

  it("throws when fetchEmbarquesListExtras RPC errors", async () => {
    mock.setRpcResult("embarques_list_extras", { data: null, error: new Error("extras fail") });
    await expect(fetchEmbarquesListExtras(["e1"])).rejects.toThrow("extras fail");
  });
});
