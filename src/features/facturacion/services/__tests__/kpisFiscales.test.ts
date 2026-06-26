import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchFacturacionKpisFiscales } from "../kpisFiscales";

describe("fetchFacturacionKpisFiscales", () => {
  beforeEach(() => { mock.tableCalls.length = 0; });

  it("agrega los counts de las 3 fuentes", async () => {
    mock.setTableResult("proformas", { data: null, error: null, count: 4 } as never);
    mock.setTableResult("facturas", { data: null, error: null, count: 7 } as never);
    mock.setTableResult("pagos_factura", { data: null, error: null, count: 2 } as never);
    const res = await fetchFacturacionKpisFiscales("org-1");
    expect(res).toEqual({ proformasConvertibles: 4, facturasSinTimbrar: 7, repsPendientes: 2 });
    expect(mock.tableCalls.map((c) => c.table).sort()).toEqual(["facturas", "pagos_factura", "proformas"]);
  });

  it("devuelve 0 cuando counts son null/undefined", async () => {
    const res = await fetchFacturacionKpisFiscales("org-1");
    expect(res).toEqual({ proformasConvertibles: 0, facturasSinTimbrar: 0, repsPendientes: 0 });
  });

  it("filtra por organization_id en cada query", async () => {
    await fetchFacturacionKpisFiscales("org-XYZ");
    for (const call of mock.tableCalls) {
      const eqArgs = call.opArgs[call.ops.indexOf("eq")];
      expect(eqArgs?.[0]).toBe("organization_id");
      expect(eqArgs?.[1]).toBe("org-XYZ");
    }
  });
});
