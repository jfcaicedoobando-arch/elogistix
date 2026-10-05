import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listarTarifasRespuesta, type TarifaRespuestaRow } from "../tarifasRespuesta";

const TABLE = "costeo_tarifas";

function makeRow(overrides: Partial<TarifaRespuestaRow> = {}): TarifaRespuestaRow {
  return {
    id: "tarifa-1",
    flete_base: 1800,
    moneda: "USD",
    unidad_flete: "contenedor",
    carta_garantia: true,
    transit_time_dias: 28,
    vigente_hasta: "2026-10-31",
    agente: { nombre: "Agente" },
    naviera: { name: "Naviera" },
    tipo: { code: "40HC" },
    ruta: { origen: { name: "Shanghai" }, destino: { name: "Manzanillo" } },
    ...overrides,
  };
}

beforeEach(() => {
  mock.resetResults();
  mock.tableCalls.length = 0;
});

describe("listarTarifasRespuesta: validación del boundary", () => {
  it("conserva filas válidas, filtro, orden y límite", async () => {
    const row = makeRow();
    mock.setTableResult(TABLE, { data: [row], error: null });

    expect(await listarTarifasRespuesta("solicitud-1")).toEqual([row]);
    const call = mock.tableCalls[0];
    expect(call.opArgs[call.ops.indexOf("eq")]).toEqual(["solicitud_pricing_id", "solicitud-1"]);
    expect(call.opArgs[call.ops.indexOf("order")]).toEqual(["created_at", { ascending: true }]);
    expect(call.opArgs[call.ops.indexOf("limit")]).toEqual([50]);
  });

  it("acepta columnas y relaciones nulas sin alterar sus valores", async () => {
    const rows = [
      makeRow({
        unidad_flete: null, carta_garantia: null, transit_time_dias: null,
        vigente_hasta: null, agente: null, naviera: null, tipo: null, ruta: null,
      }),
      makeRow({ id: "tarifa-2", ruta: { origen: null, destino: null } }),
    ];
    mock.setTableResult(TABLE, { data: rows, error: null });

    expect(await listarTarifasRespuesta("solicitud-1")).toEqual(rows);
  });

  it("conserva campos adicionales de las filas y joins", async () => {
    const row = { ...makeRow(), created_at: "2026-10-01", agente: { nombre: "Agente", id: "agente-1" } };
    mock.setTableResult(TABLE, { data: [row], error: null });

    expect(await listarTarifasRespuesta("solicitud-1")).toEqual([row]);
  });

  it("conserva la lista vacía cuando Supabase devuelve null", async () => {
    mock.setTableResult(TABLE, { data: null, error: null });

    expect(await listarTarifasRespuesta("solicitud-1")).toEqual([]);
  });

  it.each([
    { caso: "monto nulo", overrides: { flete_base: null }, path: [0, "flete_base"] },
    { caso: "monto textual", overrides: { flete_base: "1800" }, path: [0, "flete_base"] },
    { caso: "monto NaN", overrides: { flete_base: Number.NaN }, path: [0, "flete_base"] },
    { caso: "monto infinito", overrides: { flete_base: Number.POSITIVE_INFINITY }, path: [0, "flete_base"] },
    { caso: "booleano textual", overrides: { carta_garantia: "Sí" }, path: [0, "carta_garantia"] },
    { caso: "join como array", overrides: { agente: [{ nombre: "Agente" }] }, path: [0, "agente"] },
    { caso: "puerto inválido", overrides: { ruta: { origen: null, destino: { name: 7 } } }, path: [0, "ruta", "destino", "name"] },
  ])("rechaza $caso con la ubicación del campo inválido", async ({ overrides, path }) => {
    mock.setTableResult(TABLE, { data: [{ ...makeRow(), ...overrides }], error: null });

    await expect(listarTarifasRespuesta("solicitud-1")).rejects.toMatchObject({
      issues: [expect.objectContaining({ path })],
    });
  });

  it("rechaza una columna seleccionada ausente", async () => {
    const { moneda: _moneda, ...row } = makeRow();
    mock.setTableResult(TABLE, { data: [row], error: null });

    await expect(listarTarifasRespuesta("solicitud-1")).rejects.toBeInstanceOf(ZodError);
  });

  it("propaga el error de Supabase antes de validar datos", async () => {
    const error = new Error("No autorizado");
    mock.setTableResult(TABLE, { data: [{}], error });

    await expect(listarTarifasRespuesta("solicitud-1")).rejects.toBe(error);
  });
});
