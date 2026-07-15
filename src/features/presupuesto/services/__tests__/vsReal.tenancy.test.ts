import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("../categorias", () => ({ fetchCategorias: async () => [] }));
vi.mock("../mensual", () => ({ fetchPresupuestoMensualAnio: async () => [] }));

import { fetchPresupuestoVsReal } from "../vsReal";

describe("fetchPresupuestoVsReal — tenancy", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });
  });

  it("aplica organization_id en proveedor_facturas y liquidaciones_comision", async () => {
    await fetchPresupuestoVsReal("2026-06", "org-c");
    for (const table of ["proveedor_facturas", "liquidaciones_comision"]) {
      const call = mock.tableCalls.find((c) => c.table === table);
      expect(call, `sin llamada a ${table}`).toBeDefined();
      const eqCalls = call!.ops
        .map((op, i) => ({ op, args: call!.opArgs[i] }))
        .filter((p) => p.op === "eq");
      expect(
        eqCalls.some((p) => p.args[0] === "organization_id" && p.args[1] === "org-c"),
        `sin filtro de org en ${table}`,
      ).toBe(true);
    }
  });

  it("omite filtro cuando orgId es null", async () => {
    await fetchPresupuestoVsReal("2026-06", null);
    for (const table of ["proveedor_facturas", "liquidaciones_comision"]) {
      const call = mock.tableCalls.find((c) => c.table === table);
      const eqCalls = call!.ops
        .map((op, i) => ({ op, args: call!.opArgs[i] }))
        .filter((p) => p.op === "eq");
      expect(eqCalls.some((p) => p.args[0] === "organization_id")).toBe(false);
    }
  });
});
