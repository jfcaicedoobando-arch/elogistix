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
  mock.tableCalls.length = 0;
});

describe("services/cotizacion/queries", () => {
  it("constants tienen columnas críticas", () => {
    expect(COTIZACION_LIST_COLUMNS).toMatch(/folio/);
    expect(COTIZACION_ACEPTADA_COLUMNS).toMatch(/incoterm/);
  });

  it("generarFolioCotizacion arranca en 0001 sin filas", async () => {
    mock.setTableResult("cotizaciones", { data: [], error: null });
    const f = await generarFolioCotizacion();
    expect(f).toMatch(/^COT-\d{4}-0001$/);
  });

  it("generarFolioCotizacion incrementa desde último folio", async () => {
    const anio = new Date().getFullYear();
    mock.setTableResult("cotizaciones", {
      data: [{ folio: `COT-${anio}-0042` }],
      error: null,
    });
    const f = await generarFolioCotizacion();
    expect(f).toBe(`COT-${anio}-0043`);
  });

  it("generarFolioCotizacion fallback a 0001 si parse falla", async () => {
    const anio = new Date().getFullYear();
    mock.setTableResult("cotizaciones", { data: [{ folio: `COT-${anio}-XXXX` }], error: null });
    const f = await generarFolioCotizacion();
    expect(f).toBe(`COT-${anio}-0001`);
  });

  it("generarFolioCotizacion propaga error", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: { message: "x" } });
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

  it("fetchCotizacionesAceptadas filtra por estado", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1" }], error: null });
    const r = await fetchCotizacionesAceptadas("org1");
    expect(r).toHaveLength(1);
    const call = mock.tableCalls[0];
    const eqIdx = call.ops.indexOf("eq");
    expect(call.opArgs[eqIdx]).toEqual(["estado", "Aceptada"]);
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
});
