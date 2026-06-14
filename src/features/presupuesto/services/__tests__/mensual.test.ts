import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchPresupuestoMensualAnio, upsertCeldaPresupuesto } from "../mensual";

describe("mensual presupuesto service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchPresupuestoMensualAnio filtra por rango de meses", async () => {
    mock.setTableResult("presupuesto_mensual", { data: [], error: null });
    await fetchPresupuestoMensualAnio(2024);
    const call = mock.tableCalls.find(c => c.table === "presupuesto_mensual");
    expect(call?.ops).toContain("gte");
    expect(call?.ops).toContain("lte");
  });

  it("upsertCeldaPresupuesto hace upsert", async () => {
    mock.setTableResult("presupuesto_mensual", { data: [], error: null });
    await upsertCeldaPresupuesto({ categoria_id: "c1", periodo: "2024-01", monto_mxn: 1000, organization_id: "o1" });
    const call = mock.tableCalls.find(c => c.table === "presupuesto_mensual");
    expect(call?.ops).toContain("upsert");
  });
});
