import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchLiquidacionesPendientes } from "../flujoProyectado";

describe("fetchLiquidacionesPendientes — tenancy", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });
  });

  it("filtra por organization_id y deleted_at IS NULL", async () => {
    await fetchLiquidacionesPendientes("org-b");
    const call = mock.tableCalls.find((c) => c.table === "liquidaciones_comision");
    expect(call).toBeDefined();
    const pairs = call!.ops.map((op, i) => ({ op, args: call!.opArgs[i] }));
    expect(pairs.some((p) => p.op === "eq" && p.args[0] === "organization_id" && p.args[1] === "org-b"))
      .toBe(true);
    // fecha_pago + deleted_at ambos con `.is(..., null)`
    const isCalls = pairs.filter((p) => p.op === "is");
    expect(isCalls.some((p) => p.args[0] === "deleted_at" && p.args[1] === null)).toBe(true);
    expect(isCalls.some((p) => p.args[0] === "fecha_pago" && p.args[1] === null)).toBe(true);
  });

  it("omite filtro de org si no se proporciona", async () => {
    await fetchLiquidacionesPendientes();
    const call = mock.tableCalls.find((c) => c.table === "liquidaciones_comision");
    const eq = call!.ops.map((op, i) => ({ op, args: call!.opArgs[i] })).filter((p) => p.op === "eq");
    expect(eq.some((p) => p.args[0] === "organization_id")).toBe(false);
  });
});
