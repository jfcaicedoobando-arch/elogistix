import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/features/crm/domain/oportunidadPayload", () => ({
  buildOportunidadInsertPayload: vi.fn((_i: unknown, _u: unknown) => ({ nombre: "Test", etapa_id: "e-1" })),
}));

import { crearOportunidad, actualizarOportunidad, moverEtapaOportunidad, eliminarOportunidad } from "../oportunidades";

beforeEach(() => { mock.tableCalls.length = 0; });

const validInput = { nombre: "Op test", etapa_id: "e-1" };

describe("crearOportunidad", () => {
  it("inserta y devuelve id", async () => {
    mock.setTableResult("crm_oportunidades", { data: { id: "op-1" }, error: null });
    const r = await crearOportunidad(validInput, { id: "u-1", email: "a@b.com" });
    expect(r.id).toBe("op-1");
    expect(mock.tableCalls[0]?.ops).toContain("insert");
  });

  it("propaga error supabase en crearOportunidad", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: { message: "err" } });
    await expect(crearOportunidad(validInput, null)).rejects.toThrow();
  });
});

describe("actualizarOportunidad", () => {
  it("llama update con patch", async () => {
    mock.setTableResult("crm_oportunidades", { data: {}, error: null });
    await expect(actualizarOportunidad({ id: "op-1", patch: { nombre: "Nuevo" } })).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });

  it("propaga error", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: { message: "rls" } });
    await expect(actualizarOportunidad({ id: "op-1", patch: { nombre: "X" } })).rejects.toThrow();
  });
});

describe("moverEtapaOportunidad", () => {
  it("actualiza etapa_id y probabilidad", async () => {
    mock.setTableResult("crm_oportunidades", { data: {}, error: null });
    await expect(moverEtapaOportunidad({ id: "op-1", etapa_id: "e-2", probabilidad: 75 })).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });
});

describe("eliminarOportunidad", () => {
  it("soft-delete con deleted_at", async () => {
    mock.setTableResult("crm_oportunidades", { data: {}, error: null });
    await expect(eliminarOportunidad("op-1", "u-1")).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });
});
