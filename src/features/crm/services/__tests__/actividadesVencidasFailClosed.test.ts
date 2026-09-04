/**
 * Tercera tanda YAGNI · hallazgo 2 — `listActividadesVencidas` es fail-closed:
 * un error de lectura se propaga (para que la UI muestre "no se pudieron
 * cargar" y no "Sin actividades") y una lista realmente vacía devuelve `[]`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listActividadesVencidas } from "@/features/crm/services/actividades";

beforeEach(() => { mock.tableCalls.length = 0; });

describe("listActividadesVencidas — fail-closed", () => {
  it("propaga el error en vez de devolver lista vacía", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: { message: "network" } });
    await expect(listActividadesVencidas("u-1", 5, "yo@x.com")).rejects.toThrow();
  });

  it("lista realmente vacía devuelve []", async () => {
    mock.setTableResult("crm_actividades", { data: [], error: null });
    await expect(listActividadesVencidas("u-1", 5, "yo@x.com")).resolves.toEqual([]);
  });

  it("conserva filtros de responsable (id o correo legado) y deleted_at", async () => {
    mock.setTableResult("crm_actividades", { data: [], error: null });
    await listActividadesVencidas("u-1", 5, "yo@x.com");
    const call = mock.tableCalls[0]!;
    const orIdx = call.ops.indexOf("or");
    expect(String(call.opArgs[orIdx]![0])).toContain("responsable_id.eq.u-1");
    expect(String(call.opArgs[orIdx]![0])).toContain("responsable_email.eq.");
    expect(call.opArgs.some((a) => Array.isArray(a) && a[0] === "deleted_at")).toBe(true);
  });
});
