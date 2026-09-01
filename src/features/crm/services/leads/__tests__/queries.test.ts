import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CrmLeadRow } from "@/features/crm/domain/leads/constants";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listLeads, getLead } from "../queries";

const TABLE = "crm_leads";

function makeRow(o: Partial<CrmLeadRow> = {}): CrmLeadRow {
  return { id:"lead-1", empresa:"Empresa A", contacto:"Juan", email:"j@a.com", telefono:"555",
    ciudad:"CDMX", pais:"Mexico", fuente:"Web", estado:"Nuevo", score:3, interes_modo:null,
    vendedor_id:null, vendedor_email:null, notas:null, oportunidad_convertida_id:null,
    cliente_convertido_id:null, created_at:"2026-01-01T00:00:00Z", updated_at:"2026-01-01T00:00:00Z",
    deleted_at:null, deleted_by:null, created_by:null, ...o } as CrmLeadRow;
}

beforeEach(() => { mock.tableCalls.length = 0; });

describe("crm/leads/queries", () => {
  it("01 — listLeads: retorna vacío cuando data es null", async () => {
    mock.setTableResult(TABLE, { data: null, error: null });
    const res = await listLeads({});
    expect(res.data).toEqual([]);
    expect(res.count).toBe(0);
  });

  it("02 — listLeads: retorna filas correctamente", async () => {
    mock.setTableResult(TABLE, { data: [makeRow(), makeRow({ id:"lead-2" })], error: null });
    const res = await listLeads({});
    expect(res.data).toHaveLength(2);
  });

  it("03 — listLeads: lanza error si Supabase falla", async () => {
    mock.setTableResult(TABLE, { data: null, error: new Error("list fail") });
    await expect(listLeads({})).rejects.toThrow("list fail");
  });

  it("04 — listLeads: aplica filtro de estado", async () => {
    mock.setTableResult(TABLE, { data: [], error: null });
    await listLeads({ estado: "Calificado" });
    const ops = mock.tableCalls[0].ops;
    const eqIdx = ops.indexOf("eq");
    expect(mock.tableCalls[0].opArgs[eqIdx]).toContain("estado");
  });

  it("05 — listLeads: aplica filtro de fuente", async () => {
    mock.setTableResult(TABLE, { data: [], error: null });
    await listLeads({ fuente: "Web" });
    const ops = mock.tableCalls[0].ops;
    const eqIdx = ops.indexOf("eq");
    expect(mock.tableCalls[0].opArgs[eqIdx]).toContain("fuente");
  });

  it("06 — listLeads: aplica or cuando hay search", async () => {
    mock.setTableResult(TABLE, { data: [], error: null });
    await listLeads({ search: "acme" });
    expect(mock.tableCalls[0].ops).toContain("or");
  });

  it("07 — listLeads: no aplica or cuando search está vacío", async () => {
    mock.setTableResult(TABLE, { data: [], error: null });
    await listLeads({ search: "" });
    expect(mock.tableCalls[0].ops).not.toContain("or");
  });

  it("08 — listLeads: aplica range con page y pageSize correctos", async () => {
    mock.setTableResult(TABLE, { data: [], error: null });
    await listLeads({ page: 2, pageSize: 10 });
    const ops = mock.tableCalls[0].ops;
    const rangeIdx = ops.indexOf("range");
    expect(mock.tableCalls[0].opArgs[rangeIdx]).toEqual([20, 29]);
  });

  it("09 — getLead: retorna null cuando data es null", async () => {
    mock.setTableResult(TABLE, { data: null, error: null });
    expect(await getLead("non-existent")).toBeNull();
  });

  it("10 — getLead: retorna la fila cuando existe", async () => {
    mock.setTableResult(TABLE, { data: makeRow({ id:"lead-7", empresa:"ACME" }), error: null });
    const res = await getLead("lead-7");
    expect(res?.empresa).toBe("ACME");
  });
  it("11 — getLead: exige deleted_at null (soft-delete no resuelve por URL)", async () => {
    mock.setTableResult(TABLE, { data: null, error: null });
    await getLead("lead-borrado");
    const call = mock.tableCalls[0];
    const isIdx = call.ops.indexOf("is");
    expect(isIdx).toBeGreaterThanOrEqual(0);
    expect(call.opArgs[isIdx]).toEqual(["deleted_at", null]);
  });
});
