/**
 * Blindaje de Batch A: fetchEmbarquesMes debe excluir estado='Cancelado'
 * y filtrar por organizationId cuando se pasa.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const { mockRef } = vi.hoisted(() => ({
  mockRef: { current: null as ReturnType<typeof createSupabaseMock> | null },
}));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() { return mockRef.current!.supabase; },
}));

import { fetchEmbarquesMes, fetchConceptosYFacturas } from "../fetchSources";

describe("fetchEmbarquesMes", () => {
  beforeEach(() => { mockRef.current = createSupabaseMock(); });

  it("excluye estado='Cancelado' via .neq y filtra por organizationId", async () => {
    mockRef.current!.setTableResult("embarques", { data: [], error: null });
    await fetchEmbarquesMes("org-1", "2026-07-01", "2026-07-31");
    const call = mockRef.current!.tableCalls.find((c) => c.table === "embarques");
    expect(call).toBeDefined();
    const neqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "not");
    expect(neqCalls).toContainEqual(["estado", "in", "(Cotización,Borrador,Cancelado)"]);
    const eqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "eq");
    expect(eqCalls).toContainEqual(["organization_id", "org-1"]);
  });

  it("sin organizationId aún aplica .neq(estado, Cancelado)", async () => {
    mockRef.current!.setTableResult("embarques", { data: [], error: null });
    await fetchEmbarquesMes(null, "2026-07-01", "2026-07-31");
    const call = mockRef.current!.tableCalls.find((c) => c.table === "embarques");
    const neqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "not");
    expect(neqCalls).toContainEqual(["estado", "in", "(Cotización,Borrador,Cancelado)"]);
  });
});


describe("audit127 projection source", () => {
  it("keeps all200 operational sales alongside150 emitted base", async () => {
    mockRef.current = createSupabaseMock();
    const projected = [{ id: "cv150", embarque_id: "e1", total: 150, moneda: "MXN" },
      { id: "cv50", embarque_id: "e1", total: 50, moneda: "MXN" }];
    mockRef.current.setTableResult("conceptos_venta", { data: projected, error: null });
    mockRef.current.setTableResult("facturas", { data: [{ id: "f1", embarque_id: "e1",
      expediente: "ELNAC16", proforma_id: null, moneda: "MXN", subtotal: 150,
      factura_pdf_url: null, tipo_cambio: 1, conceptos_factura: [], factura_embarques: [],
    }], error: null });
    mockRef.current.setRpcResult("venta_facturada_embarques", { data: [
      { embarque_id: "e1", venta_mxn: 150, venta_doc: 150, moneda: "MXN" },
    ], error: null });
    const result = await fetchConceptosYFacturas(["e1"], ["ELNAC16"], "org-1");
    expect(result.ventas).toEqual(projected);
    expect(result.facturadas[0].total).toBe(150);
    expect(result.pendientes).toEqual([{ ...projected[1], total: 50 }]);
  });
});
