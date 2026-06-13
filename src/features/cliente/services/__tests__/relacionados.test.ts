import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchEmbarquesCliente, fetchCotizacionesCliente } from "../relacionados";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("cliente/services/relacionados", () => {
  it("relacionados.embarques: filtra por cliente_id", async () => {
    mock.setTableResult("embarques", { data: [], error: null });
    await fetchEmbarquesCliente("c1");
    const call = mock.tableCalls.find((c) => c.table === "embarques");
    const eqIdx = call?.ops.indexOf("eq") ?? -1;
    expect(call?.opArgs[eqIdx]).toEqual(["cliente_id", "c1"]);
  });

  it("relacionados.embarques: ordena por created_at desc", async () => {
    mock.setTableResult("embarques", { data: [], error: null });
    await fetchEmbarquesCliente("c1");
    const call = mock.tableCalls.find((c) => c.table === "embarques");
    const idx = call?.ops.indexOf("order") ?? -1;
    expect(call?.opArgs[idx]?.[0]).toBe("created_at");
    expect((call?.opArgs[idx]?.[1] as { ascending?: boolean })?.ascending).toBe(false);
  });

  it("relacionados.embarques: devuelve [] si data es null", async () => {
    mock.setTableResult("embarques", { data: null, error: null });
    const r = await fetchEmbarquesCliente("c1");
    expect(r).toEqual([]);
  });

  it("relacionados.embarques: propaga error", async () => {
    mock.setTableResult("embarques", { data: null, error: { message: "x" } });
    await expect(fetchEmbarquesCliente("c1")).rejects.toBeDefined();
  });

  it("relacionados.embarques: retorna data tal cual", async () => {
    const data = [{ id: "e1", expediente: "EXP-1", modo: "Marítimo" }];
    mock.setTableResult("embarques", { data, error: null });
    const r = await fetchEmbarquesCliente("c1");
    expect(r).toHaveLength(1);
  });

  it("relacionados.cotizaciones: filtra por cliente_id", async () => {
    mock.setTableResult("cotizaciones", { data: [], error: null });
    await fetchCotizacionesCliente("c1");
    const call = mock.tableCalls.find((c) => c.table === "cotizaciones");
    const eqIdx = call?.ops.indexOf("eq") ?? -1;
    expect(call?.opArgs[eqIdx]).toEqual(["cliente_id", "c1"]);
  });

  it("relacionados.cotizaciones: ordena por created_at desc", async () => {
    mock.setTableResult("cotizaciones", { data: [], error: null });
    await fetchCotizacionesCliente("c1");
    const call = mock.tableCalls.find((c) => c.table === "cotizaciones");
    const idx = call?.ops.indexOf("order") ?? -1;
    expect(call?.opArgs[idx]?.[0]).toBe("created_at");
  });

  it("relacionados.cotizaciones: devuelve [] si data null", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    const r = await fetchCotizacionesCliente("c1");
    expect(r).toEqual([]);
  });

  it("relacionados.cotizaciones: propaga error", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: { message: "x" } });
    await expect(fetchCotizacionesCliente("c1")).rejects.toBeDefined();
  });

  it("relacionados.cotizaciones: retorna registros", async () => {
    const data = [{ id: "q1", folio: "C-1", modo: "Aéreo" }];
    mock.setTableResult("cotizaciones", { data, error: null });
    const r = await fetchCotizacionesCliente("c1");
    expect(r[0].id).toBe("q1");
  });
});
