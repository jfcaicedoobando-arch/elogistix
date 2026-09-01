/**
 * A-9 (auditoría v14): listarPagosProveedorGlobal debe aplicar
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

import { listarPagosProveedorGlobal } from "../pagosGlobal";

describe("listarPagosProveedorGlobal · organization filter", () => {
  beforeEach(() => { mockRef.current = createSupabaseMock(); });

  it("pagos globales: aplica .eq(organization_id, ...) cuando se pasa organizationId", async () => {
    mockRef.current!.setTableResult("pagos_proveedor", { data: [], error: null });
    await listarPagosProveedorGlobal({}, "org-1");
    const call = mockRef.current!.tableCalls.find((c) => c.table === "pagos_proveedor");
    expect(call).toBeDefined();
    const eqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "eq");
    expect(eqCalls).toContainEqual(["organization_id", "org-1"]);
  });

  it("pagos globales: no agrega .eq(organization_id) cuando organizationId es null/undefined", async () => {
    mockRef.current!.setTableResult("pagos_proveedor", { data: [], error: null });
    await listarPagosProveedorGlobal({});
    const call = mockRef.current!.tableCalls.find((c) => c.table === "pagos_proveedor");
    const eqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "eq");
    expect(eqCalls.find((args) => args[0] === "organization_id")).toBeUndefined();
  });
});
