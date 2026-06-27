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

  it("llama a rpc embarques_listado con filtros y limpia resultados", async () => {
    mock.setRpcResult("embarques_listado", {
      data: [
        {
          id: "e1",
          total_count: 1,
          costos_total: 1000,
          costos_pagados: 500,
          docs_total: 5,
          docs_pendientes: 2,
          expediente: "EXP-1"
        }
      ],
      error: null
    });

    const filters = {
      organizationId: "org-1",
      search: "test",
      filterModo: "Aéreo",
      filterCliente: "cli-1",
      filterOperador: "op-1",
      filterProforma: "con",
      fechaDesde: "2023-01-01",
      fechaHasta: "2023-12-31",
      page: 0,
      pageSize: 10,
      sortBy: "expediente", // Should map to expediente_num
      sortDir: "asc"
    } as any;

    const res = await fetchEmbarquesPaginados(filters);

    expect(mock.rpcCalls[0].fn).toBe("embarques_listado");
    expect(mock.rpcCalls[0].args).toMatchObject({
      p_organization_id: "org-1",
      p_search: "test",
      p_modo: "Aéreo",
      p_proforma: "con",
      p_sort_by: "expediente_num"
    });

    expect(res.data[0].id).toBe("e1");
    expect((res.data[0] as any).total_count).toBeUndefined(); // Should be cleaned
    expect(res.count).toBe(1);
    expect(res.extras.liquidacion["e1"]).toEqual({ total: 1000, pagados: 500 });
    expect(res.extras.docs["e1"]).toEqual({ total: 5, pendientes: 2 });
  });

  it("maneja valores por defecto y filtros 'todos'", async () => {
    mock.setRpcResult("embarques_listado", { data: [], error: null });

    const filters = {
      organizationId: null,
      search: "",
      filterModo: "todos",
      filterCliente: "todos",
      filterOperador: "todos",
      filterProforma: "todos",
      page: 1,
      pageSize: 20
    } as any;

    const res = await fetchEmbarquesPaginados(filters);

    expect(mock.rpcCalls[0].args).toMatchObject({
      p_organization_id: undefined,
      p_search: undefined,
      p_modo: undefined,
      p_proforma: undefined,
      p_offset: 20,
      p_limit: 20,
      p_sort_by: "expediente_num",
      p_sort_dir: "desc"
    });
    expect(res.count).toBe(0);
  });

  it("maneja proforma 'sin' y sorting por columna permitida", async () => {
    mock.setRpcResult("embarques_listado", { data: [], error: null });
    await fetchEmbarquesPaginados({
      filterProforma: "sin",
      sortBy: "cliente_nombre",
      page: 0,
      pageSize: 10
    } as any);
    expect(mock.rpcCalls[0].args.p_proforma).toBe("sin");
    expect(mock.rpcCalls[0].args.p_sort_by).toBe("cliente_nombre");
  });

  it("lanza error si falla el rpc", async () => {
    mock.setRpcResult("embarques_listado", { data: null, error: new Error("rpc fail") });
    await expect(fetchEmbarquesPaginados({ page: 0, pageSize: 10 } as any)).rejects.toThrow("rpc fail");
  });
});
