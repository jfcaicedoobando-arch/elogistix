import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchEmbarquesPaginados } from "../paginados";

describe("fetchEmbarquesPaginados", () => {
  beforeEach(() => {
    mock.resetResults();
    mock.rpcCalls.length = 0;
  });

  it("llama a rpc embarques_listado con todos los filtros activos", async () => {
    mock.setRpcResult("embarques_listado", {
      data: [
        {
          id: "e1",
          total_count: "1", // string path
          costos_total: "100.50",
          costos_pagados: "50",
          docs_total: "5",
          docs_pendientes: "2",
          expediente: "EXP-1"
        }
      ],
      error: null
    });

    const res = await fetchEmbarquesPaginados({
      organizationId: "org-1",
      search: "test",
      filterModo: "Aéreo",
      filterCliente: "cli-123",
      filterOperador: "op-456",
      filterProforma: "con",
      fechaDesde: "2023-01-01",
      fechaHasta: "2023-12-31",
      page: 0,
      pageSize: 10,
      sortBy: "cliente_nombre",
      sortDir: "asc"
    } as any);

    expect(mock.rpcCalls[0].args).toMatchObject({
      p_organization_id: "org-1",
      p_modo: "Aéreo",
      p_cliente_id: "cli-123",
      p_operador: "op-456",
      p_proforma: "con",
      p_sort_by: "cliente_nombre"
    });
    expect(res.count).toBe(1);
    expect(res.extras.liquidacion["e1"].total).toBe(100.5);
  });

  it("maneja filtros 'todos' y valores por defecto", async () => {
    mock.setRpcResult("embarques_listado", { data: [], error: null });
    await fetchEmbarquesPaginados({
      filterModo: "todos",
      filterCliente: "todos",
      filterOperador: "todos",
      filterProforma: "todos",
      page: 1,
      pageSize: 20
    } as any);
    
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_modo).toBeUndefined();
    expect(args.p_cliente_id).toBeUndefined();
    expect(args.p_operador).toBeUndefined();
    expect(args.p_proforma).toBeUndefined();
    expect(args.p_offset).toBe(20);
  });

  it("maneja proforma 'sin' y sorting fallback", async () => {
    mock.setRpcResult("embarques_listado", { data: [], error: null });
    await fetchEmbarquesPaginados({
      filterProforma: "sin",
      sortBy: "invalid" as any,
      page: 0,
      pageSize: 10
    } as any);
    const args2 = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args2.p_proforma).toBe("sin");
    expect(args2.p_sort_by).toBe("expediente_num");
  });

  it("lanza error si falla el rpc", async () => {
    mock.setRpcResult("embarques_listado", { data: null, error: new Error("fail") });
    await expect(fetchEmbarquesPaginados({ page: 0, pageSize: 10 } as any)).rejects.toThrow("fail");
  });

  it("A-4: escapa % y _ literales en la búsqueda", async () => {
    mock.setRpcResult("embarques_listado", { data: [], error: null });

    await fetchEmbarquesPaginados({
      organizationId: "org-1",
      search: "100%_a",
      filterModo: "todos",
      filterCliente: "todos",
      filterOperador: "todos",
      page: 0,
      pageSize: 10,
    } as any);

    expect(mock.rpcCalls[0].args).toMatchObject({ p_search: "100\\%\\_a" });
  });
});
