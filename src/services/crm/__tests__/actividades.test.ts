import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { crearActividad, completarActividad, posponerActividad, countActividadesVencidas } from "../actividades";

beforeEach(() => { mock.tableCalls.length = 0; });

const validInput = {
  tipo: "llamada" as const,
  asunto: "Llamada de seguimiento",
  entidad_tipo: "oportunidad" as const,
  entidad_id: "op-1",
};

describe("crearActividad", () => {
  it("inserta y devuelve id", async () => {
    mock.setTableResult("crm_actividades", { data: { id: "act-1" }, error: null });
    const r = await crearActividad(validInput, { id: "u-1", email: "a@b.com" });
    expect(r.id).toBe("act-1");
    expect(mock.tableCalls[0]?.ops).toContain("insert");
  });

  it("propaga error supabase", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: { message: "err" } });
    await expect(crearActividad(validInput, null)).rejects.toBeTruthy();
  });
});

describe("completarActividad", () => {
  it("actualiza fecha_completada", async () => {
    mock.setTableResult("crm_actividades", { data: {}, error: null });
    await expect(completarActividad({ id: "act-1", resultado: "OK" })).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });
});

describe("posponerActividad", () => {
  it("actualiza fecha_programada añadiendo días", async () => {
    mock.setTableResult("crm_actividades", { data: {}, error: null });
    await expect(posponerActividad({ id: "act-1", dias: 3, fechaProgramada: "2025-01-10T00:00:00Z" })).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });
});

describe("countActividadesVencidas", () => {
  it("devuelve count", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: null });
    // The mock resolves with .then which returns { data, error, count: undefined } — service returns count ?? 0
    const n = await countActividadesVencidas("u-1");
    expect(typeof n).toBe("number");
  });
});
