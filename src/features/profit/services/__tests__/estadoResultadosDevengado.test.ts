import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

vi.mock("@/features/profit/domain/estadoResultados", () => ({
  buildEstadoResultados: vi.fn((emb, v, c) => ({ emb, v, c }))
}));

import { fetchEstadoResultadosDevengado } from "../estadoResultadosDevengado";

describe("estadoResultadosDevengado service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchEstadoResultadosDevengado consulta facturas, ncs y proveedor_facturas", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    
    await fetchEstadoResultadosDevengado({ organizationId: "o1", year: 2024, month: 1 });
    
    expect(mock.tableCalls.some(c => c.table === "facturas")).toBe(true);
    expect(mock.tableCalls.some(c => c.table === "factura_notas_credito")).toBe(true);
    expect(mock.tableCalls.some(c => c.table === "proveedor_facturas")).toBe(true);
  });

  it("resuelve embarques por expediente y por id", async () => {
    mock.setTableResult("facturas", { data: [{ id: "f1", expediente: "EXP1" }], error: null });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("proveedor_facturas", { data: [{ id: "pf1", embarque_id: "e1" }], error: null });
    mock.setTableResult("embarques", { data: [], error: null }); // para las 2 llamadas internas
    
    await fetchEstadoResultadosDevengado({ organizationId: "o1", year: 2024, month: 1 });
    const embCalls = mock.tableCalls.filter(c => c.table === "embarques");
    expect(embCalls.length).toBe(2);
  });
});
