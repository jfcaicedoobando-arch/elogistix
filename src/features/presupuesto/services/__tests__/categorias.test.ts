import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchCategorias, crearCategoria, eliminarCategoria, seedCategoriasDefault } from "../categorias";

describe("categorias presupuesto service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
  });

  it("fetchCategorias ordena por orden y nombre", async () => {
    mock.setTableResult("presupuesto_categorias", { data: [], error: null });
    await fetchCategorias();
    const call = mock.tableCalls.find(c => c.table === "presupuesto_categorias");
    expect(call?.ops).toContain("order");
  });

  it("crearCategoria inserta", async () => {
    mock.setTableResult("presupuesto_categorias", { data: { id: "1" }, error: null });
    const res = await crearCategoria({ nombre: "Cat1" } as any);
    expect(res.id).toBe("1");
  });

  it("eliminarCategoria borra registro", async () => {
    mock.setTableResult("presupuesto_categorias", { data: [], error: null });
    await eliminarCategoria("1");
    const call = mock.tableCalls.find(c => c.table === "presupuesto_categorias");
    expect(call?.ops).toContain("delete");
  });

  it("seedCategoriasDefault llama al RPC", async () => {
    mock.setRpcResult("seed_presupuesto_categorias", { data: null, error: null });
    await seedCategoriasDefault("o1");
    expect(mock.rpcCalls[0].fn).toBe("seed_presupuesto_categorias");
  });
});
