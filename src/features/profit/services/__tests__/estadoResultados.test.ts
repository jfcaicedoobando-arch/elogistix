import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

vi.mock("@/features/profit/domain/estadoResultados", () => ({
  buildEstadoResultados: vi.fn((emb, v, c) => ({ emb, v, c }))
}));

import { fetchEstadoResultadosMes } from "../estadoResultados";

describe("estadoResultados service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchEstadoResultadosMes retorna vacio si no hay embarques", async () => {
    mock.setTableResult("embarques", { data: [], error: null });
    const res = await fetchEstadoResultadosMes({ organizationId: "o1", year: 2024, month: 1 });
    expect(res).toMatchObject({ emb: [] });
  });

  it("busca conceptos_venta y conceptos_costo si hay embarques", async () => {
    mock.setTableResult("embarques", { data: [{ id: "e1", modo: "Marítimo" }], error: null });
    mock.setTableResult("conceptos_venta", { data: [], error: null });
    mock.setTableResult("conceptos_costo", { data: [], error: null });
    
    await fetchEstadoResultadosMes({ organizationId: "o1", year: 2024, month: 1 });
    expect(mock.tableCalls.some(c => c.table === "conceptos_venta")).toBe(true);
    expect(mock.tableCalls.some(c => c.table === "conceptos_costo")).toBe(true);
  });

  it("lanza error si falla la query de embarques", async () => {
    mock.setTableResult("embarques", { data: null, error: new Error("db error") });
    await expect(fetchEstadoResultadosMes({ organizationId: "o1", year: 2024, month: 1 })).rejects.toThrow("db error");
  });
});
