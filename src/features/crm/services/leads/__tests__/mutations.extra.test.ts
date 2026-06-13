/**
 * leads/mutations — extra tests (Supabase mock)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

vi.useFakeTimers({ now: new Date("2026-06-13T12:00:00Z") });

const { supabase, setTableResult, tableCalls, getMutationPayload } = createSupabaseMock();

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

import { createLead, updateLead, softDeleteLead } from "../mutations";
import type { LeadInput } from "@/features/crm/domain/leads/constants";
import type { AuthLite } from "@/features/crm/domain/leads/leadPayload";

const TABLE = "crm_leads";

const minInput: LeadInput = { empresa: "Empresa Test" };
const user: AuthLite = { id: "u-1", email: "user@test.com" };

beforeEach(() => {
  tableCalls.length = 0;
});

describe("leads/mutations (extra)", () => {
  it("01 — createLead: retorna el id del registro creado", async () => {
    setTableResult(TABLE, { data: { id: "lead-99" }, error: null });
    const res = await createLead(minInput, user);
    expect(res.id).toBe("lead-99");
  });

  it("02 — createLead: lanza error si Supabase falla", async () => {
    setTableResult(TABLE, { data: null, error: new Error("insert fail") });
    await expect(createLead(minInput, user)).rejects.toThrow("insert fail");
  });

  it("03 — createLead: payload incluye vendedor_id del usuario", async () => {
    setTableResult(TABLE, { data: { id: "x" }, error: null });
    await createLead(minInput, user);
    const payload = getMutationPayload(TABLE, "insert") as Record<string, unknown>;
    expect(payload.vendedor_id).toBe("u-1");
    expect(payload.created_by).toBe("u-1");
  });

  it("04 — createLead: payload usa defaults cuando input es mínimo", async () => {
    setTableResult(TABLE, { data: { id: "x" }, error: null });
    await createLead(minInput, user);
    const payload = getMutationPayload(TABLE, "insert") as Record<string, unknown>;
    expect(payload.estado).toBe("Nuevo");
    expect(payload.fuente).toBe("Otro");
    expect(payload.score).toBe(3);
  });

  it("05 — createLead: con user null, vendedor_id y created_by son null", async () => {
    setTableResult(TABLE, { data: { id: "x" }, error: null });
    await createLead(minInput, null);
    const payload = getMutationPayload(TABLE, "insert") as Record<string, unknown>;
    expect(payload.vendedor_id).toBeNull();
    expect(payload.created_by).toBeNull();
  });

  it("06 — updateLead: realiza update + eq con id correcto", async () => {
    setTableResult(TABLE, { data: null, error: null });
    await updateLead("lead-42", { empresa: "Nueva Empresa" });
    const call = tableCalls[0];
    expect(call.ops).toContain("update");
    expect(call.ops).toContain("eq");
    const eqIdx = call.ops.indexOf("eq");
    expect(call.opArgs[eqIdx]).toEqual(["id", "lead-42"]);
  });

  it("07 — updateLead: lanza error si Supabase falla", async () => {
    setTableResult(TABLE, { data: null, error: new Error("update fail") });
    await expect(updateLead("x", { empresa: "X" })).rejects.toThrow("update fail");
  });

  it("08 — softDeleteLead: incluye deleted_at con timestamp ISO", async () => {
    setTableResult(TABLE, { data: null, error: null });
    await softDeleteLead("lead-5", "u-1");
    const payload = getMutationPayload(TABLE, "update") as Record<string, unknown>;
    expect(payload.deleted_at).toBe("2026-06-13T12:00:00.000Z");
    expect(payload.deleted_by).toBe("u-1");
  });

  it("09 — softDeleteLead: deleted_by es null cuando userId es null", async () => {
    setTableResult(TABLE, { data: null, error: null });
    await softDeleteLead("lead-6", null);
    const payload = getMutationPayload(TABLE, "update") as Record<string, unknown>;
    expect(payload.deleted_by).toBeNull();
  });

  it("10 — softDeleteLead: lanza error si Supabase falla", async () => {
    setTableResult(TABLE, { data: null, error: new Error("soft delete fail") });
    await expect(softDeleteLead("x", "u-1")).rejects.toThrow("soft delete fail");
  });
});
