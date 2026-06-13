/**
 * leads/queries — tests (Supabase mock)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const { supabase, setTableResult, tableCalls } = createSupabaseMock();

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

import { listLeads, getLead } from "../queries";
import type { CrmLeadRow } from "@/features/crm/domain/leads/constants";

const TABLE = "crm_leads";

function makeLeadRow(overrides: Partial<CrmLeadRow> = {}): CrmLeadRow {
  return {
    id: "lead-1",
    empresa: "Empresa A",
    contacto: "Juan",
    email: "juan@a.com",
    telefono: "555-1234",
    ciudad: "CDMX",
    pais: "Mexico",
    fuente: "Web",
    estado: "Nuevo",
    score: 3,
    interes_modo: null,
    vendedor_id: null,
    vendedor_email: null,
    notas: null,
    oportunidad_convertida_id: null,
    cliente_convertido_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    deleted_by: null,
    created_by: null,
    ...overrides,
  } as CrmLeadRow;
}

beforeEach(() => {
  tableCalls.length = 0;
});

describe("leads/queries", () => {
  it("01 — listLeads: retorna data vacía cuando data es null", async () => {
    setTableResult(TABLE, { data: null, error: null });
    const res = await listLeads({});
    expect(res.data).toEqual([]);
    expect(res.count).toBe(0);
  });

  it("02 — listLeads: retorna filas y count", async () => {
    const rows = [makeLeadRow(), makeLeadRow({ id: "lead-2" })];
    setTableResult(TABLE, { data: rows, error: null });
    const res = await listLeads({});
    expect(res.data).toHaveLength(2);
  });

  it("03 — listLeads: lanza error si Supabase falla", async () => {
    setTableResult(TABLE, { data: null, error: new Error("list fail") });
    await expect(listLeads({})).rejects.toThrow("list fail");
  });

  it("04 — listLeads: aplica filtro de estado en la cadena ops", async () => {
    setTableResult(TABLE, { data: [], error: null });
    await listLeads({ estado: "Calificado" });
    const ops = tableCalls[0].ops;
    expect(ops).toContain("eq");
    const eqIdx = ops.indexOf("eq");
    expect(tableCalls[0].opArgs[eqIdx]).toContain("estado");
  });

  it("05 — listLeads: aplica filtro de fuente", async () => {
    setTableResult(TABLE, { data: [], error: null });
    await listLeads({ fuente: "Web" });
    const ops = tableCalls[0].ops;
    const eqArgs = tableCalls[0].opArgs[ops.indexOf("eq")];
    expect(eqArgs).toContain("fuente");
  });

  it("06 — listLeads: aplica or cuando hay search", async () => {
    setTableResult(TABLE, { data: [], error: null });
    await listLeads({ search: "acme" });
    const ops = tableCalls[0].ops;
    expect(ops).toContain("or");
  });

  it("07 — listLeads: no aplica or cuando search está vacío", async () => {
    setTableResult(TABLE, { data: [], error: null });
    await listLeads({ search: "" });
    expect(tableCalls[0].ops).not.toContain("or");
  });

  it("08 — listLeads: aplica range con page y pageSize", async () => {
    setTableResult(TABLE, { data: [], error: null });
    await listLeads({ page: 2, pageSize: 10 });
    const ops = tableCalls[0].ops;
    expect(ops).toContain("range");
    const rangeIdx = ops.indexOf("range");
    expect(tableCalls[0].opArgs[rangeIdx]).toEqual([20, 29]);
  });

  it("09 — getLead: retorna null cuando data es null", async () => {
    setTableResult(TABLE, { data: null, error: null });
    const res = await getLead("non-existent");
    expect(res).toBeNull();
  });

  it("10 — getLead: retorna la fila cuando existe", async () => {
    const row = makeLeadRow({ id: "lead-7", empresa: "ACME" });
    setTableResult(TABLE, { data: row, error: null });
    const res = await getLead("lead-7");
    expect(res?.empresa).toBe("ACME");
  });
});
