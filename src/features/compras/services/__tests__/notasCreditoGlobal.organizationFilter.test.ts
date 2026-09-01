/**
 * A-9 (auditoría v14): listarNotasCreditoGlobal debe aplicar
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

import { listarNotasCreditoGlobal } from "../notasCreditoGlobal";

describe("listarNotasCreditoGlobal · organization filter", () => {
  beforeEach(() => { mockRef.current = createSupabaseMock(); });

  it("notas de crédito: aplica .eq(organization_id, ...) cuando se pasa organizationId", async () => {
    mockRef.current!.setTableResult("proveedor_notas_credito", { data: [], error: null });
    await listarNotasCreditoGlobal({}, "org-1");
    const call = mockRef.current!.tableCalls.find((c) => c.table === "proveedor_notas_credito");
    expect(call).toBeDefined();
    const eqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "eq");
    expect(eqCalls).toContainEqual(["organization_id", "org-1"]);
  });

  it("notas de crédito: no agrega .eq(organization_id) cuando organizationId es null/undefined", async () => {
    mockRef.current!.setTableResult("proveedor_notas_credito", { data: [], error: null });
    await listarNotasCreditoGlobal({});
    const call = mockRef.current!.tableCalls.find((c) => c.table === "proveedor_notas_credito");
    const eqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "eq");
    expect(eqCalls.find((args) => args[0] === "organization_id")).toBeUndefined();
  });
});
