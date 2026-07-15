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

import { fetchEmbarquesMes } from "../fetchSources";

describe("fetchEmbarquesMes", () => {
  beforeEach(() => { mockRef.current = createSupabaseMock(); });

  it("excluye estado='Cancelado' via .neq y filtra por organizationId", async () => {
    mockRef.current!.setTableResult("embarques", { data: [], error: null });
    await fetchEmbarquesMes("org-1", "2026-07-01", "2026-07-31");
    const call = mockRef.current!.tableCalls.find((c) => c.table === "embarques");
    expect(call).toBeDefined();
    const neqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "neq");
    expect(neqCalls).toContainEqual(["estado", "Cancelado"]);
    const eqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "eq");
    expect(eqCalls).toContainEqual(["organization_id", "org-1"]);
  });

  it("sin organizationId aún aplica .neq(estado, Cancelado)", async () => {
    mockRef.current!.setTableResult("embarques", { data: [], error: null });
    await fetchEmbarquesMes(null, "2026-07-01", "2026-07-31");
    const call = mockRef.current!.tableCalls.find((c) => c.table === "embarques");
    const neqCalls = call!.opArgs.filter((_, i) => call!.ops[i] === "neq");
    expect(neqCalls).toContainEqual(["estado", "Cancelado"]);
  });
});
