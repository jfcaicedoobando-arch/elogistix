import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/cotizacion/queries", () => ({
  generarFolioCotizacion: vi.fn().mockResolvedValue("COT-2026-0001"),
}));

import {
  crearCotizacionInformativa,
  parseTarifasInformativas,
} from "@/services/cotizacion/informativa";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("parseTarifasInformativas", () => {
  it("devuelve [] cuando entrada no es array", () => {
    expect(parseTarifasInformativas(null)).toEqual([]);
    expect(parseTarifasInformativas("x")).toEqual([]);
    expect(parseTarifasInformativas(42)).toEqual([]);
  });

  it("filtra elementos no objeto", () => {
    expect(parseTarifasInformativas([null, "x", 1])).toEqual([]);
  });

  it("mapea fila completa", () => {
    const r = parseTarifasInformativas([
      {
        id: "a",
        modo: "Marítimo",
        modalidad_equipo: "FCL",
        origen: "MXZLO",
        punto_intermedio: "USLAX",
        destino: "USHOU",
        tipo_contenedor: "40HQ",
        unidad_medida: "Contenedor",
        precio: 1500,
        moneda: "USD",
        notas: "n",
      },
    ]);
    expect(r[0]).toMatchObject({ id: "a", modo: "Marítimo", precio: 1500 });
  });

  it("aplica defaults para campos faltantes", () => {
    const r = parseTarifasInformativas([{}]);
    expect(r[0]).toMatchObject({
      id: "t-0",
      modo: "",
      origen: "",
      destino: "",
      unidad_medida: "Contenedor",
      precio: 0,
      moneda: "USD",
    });
  });

  it("genera id auto-incremental con prefijo t-", () => {
    const r = parseTarifasInformativas([{}, {}]);
    expect(r[0].id).toBe("t-0");
    expect(r[1].id).toBe("t-1");
  });

  it("respeta id provisto", () => {
    expect(parseTarifasInformativas([{ id: "abc" }])[0].id).toBe("abc");
  });

  it("convierte precio numérico desde string", () => {
    expect(parseTarifasInformativas([{ precio: "250" }])[0].precio).toBe(250);
  });

  it("crearCotizacionInformativa inserta payload con folio", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "c1", folio: "COT-2026-0001" }, error: null });
    const r = await crearCotizacionInformativa({
      cliente_id: "cli-1",
      cliente_nombre: "ACME",
      es_prospecto: false,
      vigencia_desde: "2026-01-01",
      vigencia_hasta: "2026-12-31",
      operador: "op",
      tarifas: [{ origen: "MX", destino: "US" }] as never,
    } as never);
    const payload = mock.getMutationPayload("cotizaciones") as Record<string, unknown>;
    expect(payload.folio).toBe("COT-2026-0001");
    expect(payload.tipo_documento).toBe("informativa");
    expect(payload.origen).toBe("MX");
    expect(r).toBeTruthy();
  });

  it("crearCotizacionInformativa con es_prospecto pone cliente_id null", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "c1" }, error: null });
    await crearCotizacionInformativa({
      cliente_id: "cli-1",
      cliente_nombre: "X",
      es_prospecto: true,
      vigencia_desde: "2026-01-01",
      vigencia_hasta: "2026-12-31",
      operador: "op",
      tarifas: [],
    } as never);
    const p = mock.getMutationPayload("cotizaciones") as Record<string, unknown>;
    expect(p.cliente_id).toBeNull();
    expect(p.es_prospecto).toBe(true);
  });

  it("crearCotizacionInformativa sin tarifas deja origen/destino vacíos", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "c1" }, error: null });
    await crearCotizacionInformativa({
      cliente_id: "c",
      cliente_nombre: "X",
      es_prospecto: false,
      vigencia_desde: "2026-01-01",
      vigencia_hasta: "2026-12-31",
      operador: "op",
      tarifas: [],
    } as never);
    const p = mock.getMutationPayload("cotizaciones") as Record<string, unknown>;
    expect(p.origen).toBe("");
    expect(p.destino).toBe("");
  });

  it("crearCotizacionInformativa propaga error", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: { message: "boom" } });
    await expect(
      crearCotizacionInformativa({
        cliente_id: "c",
        cliente_nombre: "X",
        es_prospecto: false,
        vigencia_desde: "2026-01-01",
        vigencia_hasta: "2026-12-31",
        operador: "op",
        tarifas: [],
      } as never),
    ).rejects.toBeTruthy();
  });

  it("crearCotizacionInformativa default estado Enviada", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "c1" }, error: null });
    await crearCotizacionInformativa({
      cliente_id: "c",
      cliente_nombre: "X",
      es_prospecto: false,
      vigencia_desde: "2026-01-01",
      vigencia_hasta: "2026-12-31",
      operador: "op",
      tarifas: [],
    } as never);
    const p = mock.getMutationPayload("cotizaciones") as Record<string, unknown>;
    expect(p.estado).toBe("Enviada");
  });
});
