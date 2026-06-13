import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { propagarConversionProspectoCRM } from "../propagarConversion";

beforeEach(() => { mock.tableCalls.length = 0; });

describe("propagarConversionProspectoCRM", () => {
  it("no-op cuando oportunidadId es null", async () => {
    await expect(propagarConversionProspectoCRM({ oportunidadId: null, clienteId: "c-1", clienteNombre: "Acme" })).resolves.toBeUndefined();
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("actualiza oportunidad sin lead_id (sin actualizar leads)", async () => {
    mock.setTableResult("crm_oportunidades", { data: { lead_id: null }, error: null });
    await propagarConversionProspectoCRM({ oportunidadId: "op-1", clienteId: "c-1", clienteNombre: "Acme" });
    const tables = mock.tableCalls.map((c) => c.table);
    expect(tables.filter((t) => t === "crm_oportunidades")).toHaveLength(2); // select + update
    expect(tables).not.toContain("crm_leads");
  });

  it("actualiza oportunidad y lead cuando hay lead_id", async () => {
    // First call (maybeSingle) returns lead_id; second call (update op) returns ok; third (update lead) returns ok
    mock.setTableResult("crm_oportunidades", { data: { lead_id: "lead-1" }, error: null });
    mock.setTableResult("crm_leads", { data: {}, error: null });
    await propagarConversionProspectoCRM({ oportunidadId: "op-1", clienteId: "c-1", clienteNombre: "Acme" });
    const tables = mock.tableCalls.map((c) => c.table);
    expect(tables).toContain("crm_leads");
  });

  it("propaga error del select de oportunidad", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: { message: "db error" } });
    await expect(propagarConversionProspectoCRM({ oportunidadId: "op-1", clienteId: "c-1", clienteNombre: "X" })).rejects.toBeTruthy();
  });
});
