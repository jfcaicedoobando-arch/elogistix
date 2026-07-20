import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  generarFolioCotizacion,
  fetchCotizaciones,
  fetchCotizacionesAceptadas,
  fetchCotizacionById,
  fetchEmbarquesVinculados,
  COTIZACION_LIST_COLUMNS,
  COTIZACION_ACEPTADA_COLUMNS,
} from "@/features/cotizacion/services/queries";

beforeEach(() => {
  mock.resetResults();
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("services/cotizacion/queries", () => {
  it("constants tienen columnas críticas", () => {
    expect(COTIZACION_LIST_COLUMNS).toMatch(/folio/);
    expect(COTIZACION_ACEPTADA_COLUMNS).toMatch(/incoterm/);
  });

  // v13.303.0 (FIX-05): el folio se pide a la RPC atómica, no a `MAX(folio)`.
  it("generarFolioCotizacion devuelve el folio de la RPC", async () => {
    mock.setRpcResult("siguiente_folio_cotizacion", { data: "COT-2026-0042", error: null });
    const f = await generarFolioCotizacion();
    expect(f).toBe("COT-2026-0042");
    expect(mock.rpcCalls[0].fn).toBe("siguiente_folio_cotizacion");
  });

  it("generarFolioCotizacion falla si la RPC devuelve payload vacío", async () => {
    mock.setRpcResult("siguiente_folio_cotizacion", { data: null, error: null });
    await expect(generarFolioCotizacion()).rejects.toThrow(/folio/i);
  });

  it("generarFolioCotizacion propaga error de la RPC", async () => {
    mock.setRpcResult("siguiente_folio_cotizacion", { data: null, error: { message: "x" } });
    await expect(generarFolioCotizacion()).rejects.toThrow();
  });


  it("fetchCotizaciones devuelve lista", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1" }], error: null });
    const r = await fetchCotizaciones("org1");
    expect(r).toHaveLength(1);
  });

  it("fetchCotizaciones funciona sin organizationId", async () => {
    mock.setTableResult("cotizaciones", { data: [], error: null });
    const r = await fetchCotizaciones(null);
    expect(r).toEqual([]);
  });

  it("fetchCotizaciones propaga error", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: { message: "x" } });
    await expect(fetchCotizaciones("org1")).rejects.toThrow();
  });

  it("fetchCotizacionesAceptadas filtra por estados Aceptada o En operación", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1" }], error: null });
    const r = await fetchCotizacionesAceptadas("org1");
    expect(r).toHaveLength(1);
    const call = mock.tableCalls[0];
    const inIdx = call.ops.indexOf("in");
    expect(call.opArgs[inIdx]).toEqual(["estado", ["Aceptada", "En operación"]]);
  });

  it("fetchCotizacionById devuelve cotización", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "c1", folio: "X" }, error: null });
    const r = await fetchCotizacionById("c1");
    expect(r?.id).toBe("c1");
  });

  it("fetchCotizacionById devuelve null cuando no existe (PGRST116)", async () => {
    // 13.297.1 — .maybeSingle() no lanza en 0 rows; devuelve null.
    mock.setTableResult("cotizaciones", { data: null, error: null });
    const r = await fetchCotizacionById("c1");
    expect(r).toBeNull();
  });

  it("fetchCotizacionById propaga error", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: { message: "x" } });
    await expect(fetchCotizacionById("c1")).rejects.toThrow();
  });

  it("fetchEmbarquesVinculados devuelve lista", async () => {
    mock.setTableResult("embarques", { data: [{ id: "e1" }], error: null });
    const r = await fetchEmbarquesVinculados("c1");
    expect(r).toHaveLength(1);
  });

  it("fetchEmbarquesVinculados devuelve [] cuando data null", async () => {
    mock.setTableResult("embarques", { data: null, error: null });
    const r = await fetchEmbarquesVinculados("c1");
    expect(r).toEqual([]);
  });

  // v13.303.14: los embarques soft-deleted (deleted_at != null) NO deben
  // bloquear la re-conversión de la cotización.
  it("fetchEmbarquesVinculados filtra soft-deleted (deleted_at is null)", async () => {
    mock.setTableResult("embarques", { data: [], error: null });
    await fetchEmbarquesVinculados("c1");
    const call = mock.tableCalls[0];
    const isIdx = call.ops.indexOf("is");
    expect(isIdx).toBeGreaterThanOrEqual(0);
    expect(call.opArgs[isIdx]).toEqual(["deleted_at", null]);
  });
});

