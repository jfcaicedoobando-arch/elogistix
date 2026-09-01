/**
 * A-9 (auditoría v14): fetchFacturasReporte debe aplicar
 * `.eq("organization_id", ...)` cuando recibe organizationId.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const { mockRef } = vi.hoisted(() => ({
  mockRef: { current: null as ReturnType<typeof createSupabaseMock> | null },
}));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() { return mockRef.current!.supabase; },
}));

import { fetchFacturasReporte } from "../reportesFetch";

describe("fetchFacturasReporte · organization filter", () => {
  beforeEach(() => { mockRef.current = createSupabaseMock(); });

  it("reportes de compras: aplica .eq(organization_id, ...) cuando se pasa organizationId", async () => {
    mockRef.current!.setTableResult("proveedor_facturas", { data: [], error: null });
    await fetchFacturasReporte("2026-01-01", "2026-01-31", "org-1");
    const call = mockRef.current!.tableCalls.find((c) => c.table === "proveedor_facturas");
    expect(call).toBeDefined();
    const eqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "eq");
    expect(eqCalls).toContainEqual(["organization_id", "org-1"]);
  });

  it("reportes de compras: no agrega .eq(organization_id) cuando organizationId es null/undefined", async () => {
    mockRef.current!.setTableResult("proveedor_facturas", { data: [], error: null });
    await fetchFacturasReporte("2026-01-01", "2026-01-31");
    const call = mockRef.current!.tableCalls.find((c) => c.table === "proveedor_facturas");
    const eqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "eq");
    expect(eqCalls.find((args) => args[0] === "organization_id")).toBeUndefined();
  });
});
