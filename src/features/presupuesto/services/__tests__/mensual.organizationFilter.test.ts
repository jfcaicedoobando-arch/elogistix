/**
 * Blindaje de Batch A: fetchPresupuestoMensualAnio debe aplicar
 * `.eq("organization_id", ...)` cuando recibe organizationId, y omitirlo
 * cuando no. Evita regresión cross-tenant.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const { mockRef } = vi.hoisted(() => ({
  mockRef: { current: null as ReturnType<typeof createSupabaseMock> | null },
}));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() { return mockRef.current!.supabase; },
}));

import { fetchPresupuestoMensualAnio } from "../mensual";

describe("fetchPresupuestoMensualAnio · organization filter", () => {
  beforeEach(() => { mockRef.current = createSupabaseMock(); });

  it("presupuesto mensual: aplica .eq(organization_id, ...) cuando se pasa organizationId", async () => {
    mockRef.current!.setTableResult("presupuesto_mensual", { data: [], error: null });
    await fetchPresupuestoMensualAnio(2026, "org-1");
    const call = mockRef.current!.tableCalls.find((c) => c.table === "presupuesto_mensual");
    expect(call).toBeDefined();
    const eqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "eq");
    expect(eqCalls).toContainEqual(["organization_id", "org-1"]);
  });

  it("presupuesto mensual: no agrega .eq(organization_id) cuando organizationId es null/undefined", async () => {
    mockRef.current!.setTableResult("presupuesto_mensual", { data: [], error: null });
    await fetchPresupuestoMensualAnio(2026);
    const call = mockRef.current!.tableCalls.find((c) => c.table === "presupuesto_mensual");
    const eqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "eq");
    expect(eqCalls.find((args) => args[0] === "organization_id")).toBeUndefined();
  });
});
