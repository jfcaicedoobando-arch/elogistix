/**
 * leads/bulk — tests (Supabase mock)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

vi.useFakeTimers({ now: new Date("2026-06-13T12:00:00Z") });

const { supabase, setTableResult, tableCalls, getMutationPayload } = createSupabaseMock();

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

import { bulkUpdateLeads, bulkSoftDeleteLeads, bulkCreateLeads } from "../bulk";
import type { LeadInput } from "@/features/crm/domain/leads/constants";
import type { AuthLite } from "@/features/crm/domain/leads/leadPayload";

const TABLE = "crm_leads";
const user: AuthLite = { id: "u-1", email: "user@test.com" };

beforeEach(() => {
  tableCalls.length = 0;
  setTableResult(TABLE, { data: null, error: null });
});

describe("leads/bulk", () => {
  it("01 — bulkUpdateLeads: retorna 0 con arreglo vacío sin llamar a Supabase", async () => {
    const res = await bulkUpdateLeads([], { empresa: "X" });
    expect(res).toBe(0);
    expect(tableCalls).toHaveLength(0);
  });

  it("02 — bulkUpdateLeads: retorna la cantidad de ids actualizados", async () => {
    const res = await bulkUpdateLeads(["a", "b", "c"], { estado: "Contactado" });
    expect(res).toBe(3);
  });

  it("03 — bulkUpdateLeads: aplica .in con los ids correctos", async () => {
    await bulkUpdateLeads(["id-1", "id-2"], { fuente: "Web" });
    const ops = tableCalls[0].ops;
    expect(ops).toContain("in");
    const inIdx = ops.indexOf("in");
    expect(tableCalls[0].opArgs[inIdx]).toEqual(["id", ["id-1", "id-2"]]);
  });

  it("04 — bulkUpdateLeads: lanza error si Supabase falla", async () => {
    setTableResult(TABLE, { data: null, error: new Error("bulk update fail") });
    await expect(bulkUpdateLeads(["x"], { empresa: "Z" })).rejects.toThrow("bulk update fail");
  });

  it("05 — bulkSoftDeleteLeads: retorna 0 con arreglo vacío sin llamar a Supabase", async () => {
    const res = await bulkSoftDeleteLeads([], "u-1");
    expect(res).toBe(0);
    expect(tableCalls).toHaveLength(0);
  });

  it("06 — bulkSoftDeleteLeads: retorna la cantidad de ids eliminados", async () => {
    const res = await bulkSoftDeleteLeads(["a", "b"], "u-1");
    expect(res).toBe(2);
  });

  it("07 — bulkSoftDeleteLeads: incluye deleted_at y deleted_by en el payload", async () => {
    await bulkSoftDeleteLeads(["lead-x"], "u-99");
    const payload = getMutationPayload(TABLE, "update") as Record<string, unknown>;
    expect(payload.deleted_at).toBe("2026-06-13T12:00:00.000Z");
    expect(payload.deleted_by).toBe("u-99");
  });

  it("08 — bulkSoftDeleteLeads: lanza error si Supabase falla", async () => {
    setTableResult(TABLE, { data: null, error: new Error("bulk delete fail") });
    await expect(bulkSoftDeleteLeads(["x"], null)).rejects.toThrow("bulk delete fail");
  });

  it("09 — bulkCreateLeads: retorna 0 con arreglo vacío sin llamar a Supabase", async () => {
    const res = await bulkCreateLeads([], user);
    expect(res).toBe(0);
    expect(tableCalls).toHaveLength(0);
  });

  it("10 — bulkCreateLeads: lanza error si Supabase falla en el primer chunk", async () => {
    setTableResult(TABLE, { data: null, error: new Error("bulk create fail") });
    const inputs: LeadInput[] = [{ empresa: "A" }, { empresa: "B" }];
    await expect(bulkCreateLeads(inputs, user)).rejects.toThrow("bulk create fail");
  });
});
