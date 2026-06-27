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
      sortBy: "expediente",
      sortDir: "asc"
    } as any;

    const res = await fetchEmbarquesPaginados(filters);

    expect(mock.rpcCalls[0].fn).toBe("embarques_listado");
    expect(mock.rpcCalls[0].args).toMatchObject({
      p_organization_id: "org-1",
      p_search: "test",
      p_modo: "Aéreo",
      p_proforma: "con",
      p_sort_by: "expediente"
    });

    expect(res.data[0].id).toBe("e1");
    expect((res.data[0] as any).total_count).toBeUndefined();
    expect(res.count).toBe(1);
    expect(res.extras.liquidacion["e1"]).toEqual({ total: 1000, pagados: 500 });
  });

  it("maneja fallback de sorting y filtros nulos", async () => {
    mock.setRpcResult("embarques_listado", { data: [], error: null });
    await fetchEmbarquesPaginados({ 
      page: 0, 
      pageSize: 10,
      sortBy: "invalid_col" as any 
    } as any);
    expect(mock.rpcCalls[0].args.p_sort_by).toBe("expediente_num");
  });
});
