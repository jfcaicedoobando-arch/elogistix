import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchBitacoraEmbarque } from "../bitacoraEmbarque";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("embarques/services/bitacoraEmbarque", () => {
  it("bitacora.fetch: devuelve [] cuando data es null", async () => {
    mock.setTableResult("bitacora_actividad", { data: null, error: null });
    const r = await fetchBitacoraEmbarque("e1", null);
    expect(r).toEqual([]);
  });

  it("bitacora.fetch: aplica or con dos cláusulas cuando hay expediente", async () => {
    mock.setTableResult("bitacora_actividad", { data: [], error: null });
    await fetchBitacoraEmbarque("e1", "EXP-1");
    const call = mock.tableCalls.find((c) => c.table === "bitacora_actividad");
    const orIdx = call?.ops.indexOf("or") ?? -1;
    expect(orIdx).toBeGreaterThanOrEqual(0);
    const orArg = String(call?.opArgs[orIdx]?.[0] ?? "");
    expect(orArg).toContain("entidad_id.eq.e1");
    expect(orArg).toContain("entidad_nombre.eq.EXP-1");
  });

  it("bitacora.fetch: sin expediente sólo filtra por entidad_id", async () => {
    mock.setTableResult("bitacora_actividad", { data: [], error: null });
    await fetchBitacoraEmbarque("e1", null);
    const call = mock.tableCalls.find((c) => c.table === "bitacora_actividad");
    const orIdx = call?.ops.indexOf("or") ?? -1;
    const orArg = String(call?.opArgs[orIdx]?.[0] ?? "");
    expect(orArg).toBe("entidad_id.eq.e1");
  });

  it("bitacora.fetch: expediente undefined → mismo filtro mínimo", async () => {
    mock.setTableResult("bitacora_actividad", { data: [], error: null });
    await fetchBitacoraEmbarque("e1", undefined);
    const call = mock.tableCalls.find((c) => c.table === "bitacora_actividad");
    const orIdx = call?.ops.indexOf("or") ?? -1;
    const orArg = String(call?.opArgs[orIdx]?.[0] ?? "");
    expect(orArg).toBe("entidad_id.eq.e1");
  });

  it("bitacora.fetch: ordena por created_at desc", async () => {
    mock.setTableResult("bitacora_actividad", { data: [], error: null });
    await fetchBitacoraEmbarque("e1", null);
    const call = mock.tableCalls.find((c) => c.table === "bitacora_actividad");
    const idx = call?.ops.indexOf("order") ?? -1;
    expect(call?.opArgs[idx]?.[0]).toBe("created_at");
    expect((call?.opArgs[idx]?.[1] as { ascending?: boolean })?.ascending).toBe(false);
  });

  it("bitacora.fetch: aplica limit por defecto 100", async () => {
    mock.setTableResult("bitacora_actividad", { data: [], error: null });
    await fetchBitacoraEmbarque("e1", null);
    const call = mock.tableCalls.find((c) => c.table === "bitacora_actividad");
    const idx = call?.ops.indexOf("limit") ?? -1;
    expect(call?.opArgs[idx]?.[0]).toBe(100);
  });

  it("bitacora.fetch: respeta limit personalizado", async () => {
    mock.setTableResult("bitacora_actividad", { data: [], error: null });
    await fetchBitacoraEmbarque("e1", null, 25);
    const call = mock.tableCalls.find((c) => c.table === "bitacora_actividad");
    const idx = call?.ops.indexOf("limit") ?? -1;
    expect(call?.opArgs[idx]?.[0]).toBe(25);
  });

  it("bitacora.fetch: propaga error", async () => {
    mock.setTableResult("bitacora_actividad", { data: null, error: { message: "x" } });
    await expect(fetchBitacoraEmbarque("e1", null)).rejects.toThrow();
  });

  it("bitacora.fetch: retorna data cuando existe", async () => {
    const data = [{ id: "b1", accion: "Crear", modulo: "Embarques" }];
    mock.setTableResult("bitacora_actividad", { data, error: null });
    const r = await fetchBitacoraEmbarque("e1", null);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("b1");
  });

  it("bitacora.fetch: usa tabla bitacora_actividad", async () => {
    mock.setTableResult("bitacora_actividad", { data: [], error: null });
    await fetchBitacoraEmbarque("e1", null);
    expect(mock.tableCalls[0].table).toBe("bitacora_actividad");
  });
});
