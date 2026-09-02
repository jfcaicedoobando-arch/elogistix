import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LeadInput } from "@/features/crm/domain/leads/constants";
import type { AuthLite } from "@/features/crm/domain/leads/leadPayload";

// Fake timers POR TEST: el cleanup global llama `vi.useRealTimers()` después de
// cada caso, así que activarlos en beforeAll deja al resto con fecha real.

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { createLead, updateLead, softDeleteLead } from "../mutations";

const TABLE = "crm_leads";
const minInput: LeadInput = { empresa: "Empresa Test" };
const user: AuthLite = { id: "u-1", email: "user@test.com" };

beforeEach(() => {
  mock.tableCalls.length = 0;
  vi.useFakeTimers({ now: new Date("2026-06-13T12:00:00Z") });
});
afterEach(() => { vi.useRealTimers(); });

describe("crm/leads/mutations (extra)", () => {
  it("01 — createLead: retorna el id del registro creado", async () => {
    mock.setTableResult(TABLE, { data: { id: "lead-99" }, error: null });
    expect((await createLead(minInput, user)).id).toBe("lead-99");
  });

  it("02 — createLead: lanza error si Supabase falla", async () => {
    mock.setTableResult(TABLE, { data: null, error: new Error("insert fail") });
    await expect(createLead(minInput, user)).rejects.toThrow("insert fail");
  });

  it("03 — createLead: payload incluye vendedor_id del usuario", async () => {
    mock.setTableResult(TABLE, { data: { id: "x" }, error: null });
    await createLead(minInput, user);
    const p = mock.getMutationPayload(TABLE, "insert") as Record<string, unknown>;
    expect(p.vendedor_id).toBe("u-1");
    expect(p.created_by).toBe("u-1");
  });

  it("04 — createLead: payload usa defaults cuando input es mínimo", async () => {
    mock.setTableResult(TABLE, { data: { id: "x" }, error: null });
    await createLead(minInput, user);
    const p = mock.getMutationPayload(TABLE, "insert") as Record<string, unknown>;
    expect(p.estado).toBe("Nuevo");
    expect(p.fuente).toBe("Otro");
    expect(p.score).toBe(3);
  });

  it("05 — createLead: con user null, vendedor_id y created_by son null", async () => {
    mock.setTableResult(TABLE, { data: { id: "x" }, error: null });
    await createLead(minInput, null);
    const p = mock.getMutationPayload(TABLE, "insert") as Record<string, unknown>;
    expect(p.vendedor_id).toBeNull();
    expect(p.created_by).toBeNull();
  });

  it("06 — updateLead: realiza update + eq con id correcto", async () => {
    mock.setTableResult(TABLE, { data: { id: "lead-1" }, error: null });
    await updateLead("lead-42", { empresa: "Nueva Empresa" });
    const call = mock.tableCalls[0];
    expect(call.ops).toContain("update");
    const eqIdx = call.ops.indexOf("eq");
    expect(call.opArgs[eqIdx]).toEqual(["id", "lead-42"]);
  });

  it("07 — updateLead: lanza error si Supabase falla", async () => {
    mock.setTableResult(TABLE, { data: null, error: new Error("update fail") });
    await expect(updateLead("x", { empresa: "X" })).rejects.toThrow("update fail");
  });

  it("08 — softDeleteLead: incluye deleted_at con timestamp ISO fijo", async () => {
    mock.setTableResult(TABLE, { data: { id: "lead-1" }, error: null });
    await softDeleteLead("lead-5", "u-1");
    const p = mock.getMutationPayload(TABLE, "update") as Record<string, unknown>;
    expect(p.deleted_at).toBe("2026-06-13T12:00:00.000Z");
    expect(p.deleted_by).toBe("u-1");
  });

  it("09 — softDeleteLead: deleted_by es null cuando userId es null", async () => {
    mock.setTableResult(TABLE, { data: { id: "lead-1" }, error: null });
    await softDeleteLead("lead-6", null);
    const p = mock.getMutationPayload(TABLE, "update") as Record<string, unknown>;
    expect(p.deleted_by).toBeNull();
  });

  it("10 — softDeleteLead: lanza error si Supabase falla", async () => {
    mock.setTableResult(TABLE, { data: null, error: new Error("soft delete fail") });
    await expect(softDeleteLead("x", "u-1")).rejects.toThrow("soft delete fail");
  });
});
