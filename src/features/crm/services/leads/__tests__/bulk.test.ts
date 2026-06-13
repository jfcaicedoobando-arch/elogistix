import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { LeadInput } from "@/features/crm/domain/leads/constants";
import type { AuthLite } from "@/features/crm/domain/leads/leadPayload";

// Fake timers escopados al archivo. NUNCA en top-level: en pool forks con
// singleFork+isolate, los timers parchados a nivel de módulo pueden filtrarse
// al siguiente archivo del shard y colgar `waitFor` indefinidamente (OOM).
beforeAll(() => { vi.useFakeTimers({ now: new Date("2026-06-13T12:00:00Z") }); });
afterAll(() => { vi.useRealTimers(); });

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { bulkUpdateLeads, bulkSoftDeleteLeads, bulkCreateLeads } from "../bulk";

const TABLE = "crm_leads";
const user: AuthLite = { id: "u-1", email: "user@test.com" };

beforeEach(() => { mock.tableCalls.length = 0; mock.setTableResult(TABLE, { data: null, error: null }); });

describe("crm/leads/bulk", () => {
  it("01 — bulkUpdateLeads: retorna 0 con arreglo vacío sin llamar a Supabase", async () => {
    expect(await bulkUpdateLeads([], { empresa: "X" })).toBe(0);
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("02 — bulkUpdateLeads: retorna cantidad de ids", async () => {
    expect(await bulkUpdateLeads(["a","b","c"], { estado: "Contactado" })).toBe(3);
  });

  it("03 — bulkUpdateLeads: aplica .in con los ids correctos", async () => {
    await bulkUpdateLeads(["id-1","id-2"], { fuente: "Web" });
    const ops = mock.tableCalls[0].ops;
    const inIdx = ops.indexOf("in");
    expect(mock.tableCalls[0].opArgs[inIdx]).toEqual(["id", ["id-1","id-2"]]);
  });

  it("04 — bulkUpdateLeads: lanza error si Supabase falla", async () => {
    mock.setTableResult(TABLE, { data: null, error: new Error("bulk update fail") });
    await expect(bulkUpdateLeads(["x"], { empresa: "Z" })).rejects.toThrow("bulk update fail");
  });

  it("05 — bulkSoftDeleteLeads: retorna 0 con arreglo vacío sin llamar a Supabase", async () => {
    expect(await bulkSoftDeleteLeads([], "u-1")).toBe(0);
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("06 — bulkSoftDeleteLeads: retorna cantidad de ids", async () => {
    expect(await bulkSoftDeleteLeads(["a","b"], "u-1")).toBe(2);
  });

  it("07 — bulkSoftDeleteLeads: incluye deleted_at y deleted_by en payload", async () => {
    await bulkSoftDeleteLeads(["lead-x"], "u-99");
    const p = mock.getMutationPayload(TABLE, "update") as Record<string, unknown>;
    expect(p.deleted_at).toBe("2026-06-13T12:00:00.000Z");
    expect(p.deleted_by).toBe("u-99");
  });

  it("08 — bulkSoftDeleteLeads: lanza error si Supabase falla", async () => {
    mock.setTableResult(TABLE, { data: null, error: new Error("bulk delete fail") });
    await expect(bulkSoftDeleteLeads(["x"], null)).rejects.toThrow("bulk delete fail");
  });

  it("09 — bulkCreateLeads: retorna 0 con arreglo vacío sin llamar a Supabase", async () => {
    expect(await bulkCreateLeads([], user)).toBe(0);
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("10 — bulkCreateLeads: lanza error si Supabase falla en el primer chunk", async () => {
    mock.setTableResult(TABLE, { data: null, error: new Error("bulk create fail") });
    const inputs: LeadInput[] = [{ empresa: "A" }, { empresa: "B" }];
    await expect(bulkCreateLeads(inputs, user)).rejects.toThrow("bulk create fail");
  });
});
