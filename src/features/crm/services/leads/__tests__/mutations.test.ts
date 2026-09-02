/**
 * Tests para CRUD de leads (create/update/softDelete).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { createLead, updateLead, softDeleteLead } from "../mutations";
import type { LeadInput } from "@/features/crm/domain/leads/constants";

const leadInput = {
  empresa: "Acme",
  contacto: "Juan",
  email: "x@y.com",
  telefono: "555",
  ciudad: "CDMX",
  origen: "web",
  estado: "Nuevo",
  vendedor_id: "usr-1",
  vendedor_email: "v@x.com",
  interes_modo: "Marítimo",
  notas: "",
} as unknown as LeadInput;

const user = { id: "usr-1", email: "v@x.com" };

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("createLead", () => {
  it("happy path: devuelve { id } cuando Supabase responde", async () => {
    mock.setTableResult("crm_leads", { data: { id: "lead-new" }, error: null });
    const r = await createLead(leadInput, user);
    expect(r).toEqual({ id: "lead-new" });
    expect(mock.tableCalls[0]?.table).toBe("crm_leads");
    expect(mock.tableCalls[0]?.ops).toContain("insert");
  });

  it("propaga error de Supabase al crear lead", async () => {
    mock.setTableResult("crm_leads", { data: null, error: { message: "unique" } });
    await expect(createLead(leadInput, user)).rejects.toThrow();
  });

  it("funciona con user=null (sin sesión)", async () => {
    mock.setTableResult("crm_leads", { data: { id: "lead-anon" }, error: null });
    const r = await createLead(leadInput, null);
    expect(r.id).toBe("lead-anon");
  });
});

describe("updateLead", () => {
  it("happy path: resuelve void", async () => {
    mock.setTableResult("crm_leads", { data: { id: "lead-1" }, error: null });
    await expect(updateLead("lead-1", { estado: "Contactado" })).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.ops).toEqual(["update", "eq", "is", "select", "maybeSingle"]);
  });

  it("propaga error de Supabase al actualizar lead", async () => {
    mock.setTableResult("crm_leads", { data: null, error: { message: "x" } });
    await expect(updateLead("lead-1", {})).rejects.toThrow();
  });

  it("acepta patch vacío", async () => {
    mock.setTableResult("crm_leads", { data: { id: "lead-1" }, error: null });
    await expect(updateLead("lead-1", {})).resolves.toBeUndefined();
  });
});

describe("softDeleteLead", () => {
  it("hace update con deleted_at ISO y deleted_by", async () => {
    mock.setTableResult("crm_leads", { data: { id: "lead-1" }, error: null });
    await expect(softDeleteLead("lead-1", "usr-1")).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.ops).toEqual(["update", "eq", "is", "select", "maybeSingle"]);
  });

  it("acepta userId null", async () => {
    mock.setTableResult("crm_leads", { data: { id: "lead-1" }, error: null });
    await expect(softDeleteLead("lead-1", null)).resolves.toBeUndefined();
  });

  it("propaga error de Supabase al soft-delete lead", async () => {
    mock.setTableResult("crm_leads", { data: null, error: { message: "RLS" } });
    await expect(softDeleteLead("lead-1", "usr-1")).rejects.toThrow();
  });
});
