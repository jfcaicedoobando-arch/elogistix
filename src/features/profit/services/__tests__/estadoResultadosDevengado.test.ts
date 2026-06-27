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
    mock.rpcCalls.length = 0;
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

  it("cubre fallbacks de embarque no encontrado, tipo cambio null/0 y notas de crédito", async () => {
    // f1: sin expediente -> fallback Marítimo, tc=1 (porque tipo_cambio=0)
    // f2: con expediente pero embarque no encontrado -> fallback, tc=20
    mock.setTableResult("facturas", { 
      data: [
        { id: "f1", expediente: null, total: 1000, moneda: "USD", tipo_cambio: 0 },
        { id: "f2", expediente: "EXP-MISSING", total: 200, moneda: "USD", tipo_cambio: 20 }
      ], 
      error: null 
    });
    // nc1: nota de crédito -> bucket ventas, modo Marítimo, tc=1
    mock.setTableResult("factura_notas_credito", { 
      data: [{ factura_id: "f1", monto: 100, moneda: "USD", updated_at: "2024-01-05" }], 
      error: null 
    });
    // pf1: sin embarque_id -> fallback Marítimo, tc=1 (porque tipo_cambio_usd=null)
    mock.setTableResult("proveedor_facturas", { 
      data: [{ id: "pf1", embarque_id: null, total: 500, moneda: "USD", tipo_cambio_usd: null }], 
      error: null 
    });
    
    mock.setTableResult("embarques", { data: [], error: null });
    
    const res: any = await fetchEstadoResultadosDevengado({ organizationId: null, year: 2024, month: 1 });
    
    expect(res.emb.length).toBe(4); 
    expect(res.emb.every((e: any) => e.modo === "Marítimo")).toBe(true);
    expect(res.emb[0].tipo_cambio_usd).toBe(1);
    expect(res.emb[1].tipo_cambio_usd).toBe(20);
  });

  it("maneja errores de supabase", async () => {
    mock.setTableResult("facturas", { data: null, error: { message: "db-fail" } });
    await expect(fetchEstadoResultadosDevengado({ organizationId: null, year: 2024, month: 1 })).rejects.toThrow("db-fail");
  });
});
