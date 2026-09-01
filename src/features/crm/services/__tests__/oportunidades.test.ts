import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/features/crm/domain/oportunidadPayload", () => ({
  buildOportunidadInsertPayload: vi.fn((_i: unknown, _u: unknown) => ({ nombre: "Test", etapa_id: "e-1" })),
}));

import { crearOportunidad, actualizarOportunidad, moverEtapaOportunidad, eliminarOportunidad, getOportunidad } from "../oportunidades";

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

  it("escribe nulls explícitos para limpiar el cierre real (Ola 4 · N49)", async () => {
    mock.setTableResult("crm_oportunidades", { data: {}, error: null });
    await moverEtapaOportunidad({
      id: "op-1", etapa_id: "e-abierta",
      fecha_cierre_real: null, valor_real: null, motivo_perdida_id: null,
    });
    const call = mock.tableCalls.find((c) => c.table === "crm_oportunidades");
    const updateArgs = call?.opArgs[call.ops.indexOf("update")]?.[0] as Record<string, unknown>;
    expect(updateArgs).toMatchObject({
      fecha_cierre_real: null, valor_real: null, motivo_perdida_id: null,
    });
  });

  it("no toca el cierre real cuando no se pide (comportamiento previo)", async () => {
    mock.setTableResult("crm_oportunidades", { data: {}, error: null });
    await moverEtapaOportunidad({ id: "op-1", etapa_id: "e-2", probabilidad: 75 });
    const call = mock.tableCalls.find((c) => c.table === "crm_oportunidades");
    const updateArgs = call?.opArgs[call.ops.indexOf("update")]?.[0] as Record<string, unknown>;
    expect(updateArgs).not.toHaveProperty("fecha_cierre_real");
    expect(updateArgs).not.toHaveProperty("valor_real");
    expect(updateArgs).not.toHaveProperty("motivo_perdida_id");
  });
});

describe("eliminarOportunidad", () => {
  it("soft-delete con deleted_at", async () => {
    mock.setTableResult("crm_oportunidades", { data: {}, error: null });
    await expect(eliminarOportunidad("op-1", "u-1")).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });
});

describe("getOportunidad", () => {
  it("exige deleted_at null: una oportunidad eliminada no resuelve por URL", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    const res = await getOportunidad("op-borrada");
    expect(res).toBeNull();
    const call = mock.tableCalls.find((c) => c.table === "crm_oportunidades");
    const isIdx = call?.ops.indexOf("is") ?? -1;
    expect(isIdx).toBeGreaterThanOrEqual(0);
    expect(call?.opArgs[isIdx]).toEqual(["deleted_at", null]);
  });
});
