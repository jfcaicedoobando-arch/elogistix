import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchGarantiasEmbarque, updateGarantia } from "../garantias";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("embarques/services/garantias", () => {
  it("garantias.fetch: devuelve [] sin data", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: null, error: null });
    const r = await fetchGarantiasEmbarque("emb-1");
    expect(r).toEqual([]);
  });

  it("garantias.fetch: filtra por embarque_id con eq", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: [], error: null });
    await fetchGarantiasEmbarque("emb-1");
    const call = mock.tableCalls.find((c) => c.table === "embarque_garantias_contenedor");
    expect(call?.ops).toContain("eq");
    expect(call?.opArgs[call.ops.indexOf("eq")]).toEqual(["embarque_id", "emb-1"]);
  });

  it("garantias.fetch: propaga error de supabase", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: null, error: { message: "rls" } });
    await expect(fetchGarantiasEmbarque("e")).rejects.toThrow();
  });

  it("garantias.fetch: retorna data tal cual cuando viene array", async () => {
    const rows = [{ id: "g1", embarque_id: "e", estado: "depositado" }];
    mock.setTableResult("embarque_garantias_contenedor", { data: rows, error: null });
    const r = await fetchGarantiasEmbarque("e");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("g1");
  });

  it("garantias.update: hace update sin id en el patch", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: null, error: null });
    await updateGarantia({ id: "g1", estado: "liberado" });
    const payload = mock.getMutationPayload("embarque_garantias_contenedor", "update") as Record<string, unknown>;
    expect(payload.estado).toBe("liberado");
    expect((payload as { id?: string }).id).toBeUndefined();
  });

  it("garantias.update: persiste fecha_liberacion", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: null, error: null });
    await updateGarantia({ id: "g1", estado: "liberado", fecha_liberacion: "2026-06-13" });
    const payload = mock.getMutationPayload("embarque_garantias_contenedor", "update") as Record<string, unknown>;
    expect(payload.fecha_liberacion).toBe("2026-06-13");
  });

  it("garantias.update: persiste monto_deposito_usd", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: null, error: null });
    await updateGarantia({ id: "g1", estado: "depositado", monto_deposito_usd: 1500 });
    const payload = mock.getMutationPayload("embarque_garantias_contenedor", "update") as Record<string, unknown>;
    expect(payload.monto_deposito_usd).toBe(1500);
  });

  it("garantias.update: aplica filtro eq por id", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: null, error: null });
    await updateGarantia({ id: "g1", estado: "depositado" });
    const call = mock.tableCalls.find((c) => c.table === "embarque_garantias_contenedor");
    const idx = call?.ops.indexOf("eq") ?? -1;
    expect(call?.opArgs[idx]).toEqual(["id", "g1"]);
  });

  it("garantias.update: propaga error", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: null, error: { message: "fail" } });
    await expect(updateGarantia({ id: "g1", estado: "depositado" })).rejects.toThrow();
  });

  it("garantias.update: acepta notas y fecha_deposito", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: null, error: null });
    await updateGarantia({
      id: "g1",
      estado: "depositado",
      fecha_deposito: "2026-06-10",
      notas: "Pago BBVA",
    });
    const payload = mock.getMutationPayload("embarque_garantias_contenedor", "update") as Record<string, unknown>;
    expect(payload.fecha_deposito).toBe("2026-06-10");
    expect(payload.notas).toBe("Pago BBVA");
  });
});
