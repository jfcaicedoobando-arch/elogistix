/**
 * Test de multi-tenancy para `fetchSaldosCuentas` (Batch G).
 * Verifica que el filtro `organization_id` se aplica cuando se pasa `orgId`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchSaldosCuentas } from "../resumen";

describe("fetchSaldosCuentas — tenancy", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.setTableResult("cuentas_bancarias", { data: [], error: null });
    mock.setTableResult("bbva_movimientos", { data: [], error: null });
  });

  it("aplica .eq('organization_id', orgId) cuando se pasa un orgId", async () => {
    await fetchSaldosCuentas("org-a");
    const call = mock.tableCalls.find((c) => c.table === "cuentas_bancarias");
    expect(call).toBeDefined();
    const eqCalls = call!.ops
      .map((op, i) => ({ op, args: call!.opArgs[i] }))
      .filter((x) => x.op === "eq");
    expect(eqCalls.some((x) => x.args[0] === "organization_id" && x.args[1] === "org-a")).toBe(true);
  });

  it("NO aplica filtro de org cuando se llama sin argumento", async () => {
    await fetchSaldosCuentas();
    const call = mock.tableCalls.find((c) => c.table === "cuentas_bancarias");
    const eqCalls = call!.ops
      .map((op, i) => ({ op, args: call!.opArgs[i] }))
      .filter((x) => x.op === "eq");
    expect(eqCalls.some((x) => x.args[0] === "organization_id")).toBe(false);
  });
});
