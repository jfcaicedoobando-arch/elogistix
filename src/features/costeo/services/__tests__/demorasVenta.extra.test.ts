/**
 * demorasVenta — extra tests (Supabase mock)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const { supabase, setTableResult, tableCalls, getMutationPayload } = createSupabaseMock();

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

import {
  fetchDemorasVenta,
  crearDemoraVenta,
  eliminarDemoraVenta,
  type DemoraVentaTarifaInput,
} from "../demorasVenta";

const TABLE = "costeo_demoras_venta_tarifa";

const makeRow = (overrides: Partial<ReturnType<typeof buildRow>> = {}) =>
  buildRow(overrides);

function buildRow(o: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    tipo_contenedor_id: "tc-1",
    desde_dia: 1,
    hasta_dia: 10,
    monto_por_dia_usd: 50,
    vigente_desde: "2026-01-01",
    vigente_hasta: null,
    notas: null,
    ...o,
  };
}

beforeEach(() => {
  tableCalls.length = 0;
  setTableResult(TABLE, { data: null, error: null });
});

describe("demorasVenta (extra)", () => {
  it("01 — fetchDemorasVenta: retorna arreglo vacío cuando data es null", async () => {
    setTableResult(TABLE, { data: null, error: null });
    const res = await fetchDemorasVenta();
    expect(res).toEqual([]);
  });

  it("02 — fetchDemorasVenta: retorna las filas mapeadas", async () => {
    const rows = [makeRow(), makeRow({ id: "row-2", desde_dia: 11 })];
    setTableResult(TABLE, { data: rows, error: null });
    const res = await fetchDemorasVenta();
    expect(res).toHaveLength(2);
    expect(res[0].id).toBe("row-1");
    expect(res[1].desde_dia).toBe(11);
  });

  it("03 — fetchDemorasVenta: lanza el error de Supabase", async () => {
    setTableResult(TABLE, { data: null, error: new Error("DB error") });
    await expect(fetchDemorasVenta()).rejects.toThrow("DB error");
  });

  it("04 — fetchDemorasVenta: llama a from con la tabla correcta", async () => {
    setTableResult(TABLE, { data: [], error: null });
    await fetchDemorasVenta();
    expect(tableCalls[0].table).toBe(TABLE);
  });

  it("05 — fetchDemorasVenta: incluye operaciones order en la cadena", async () => {
    setTableResult(TABLE, { data: [], error: null });
    await fetchDemorasVenta();
    const ops = tableCalls[0].ops;
    expect(ops).toContain("order");
  });

  it("06 — crearDemoraVenta: inserta el payload correcto", async () => {
    setTableResult(TABLE, { data: null, error: null });
    const input: DemoraVentaTarifaInput = {
      tipo_contenedor_id: "tc-99",
      desde_dia: 5,
      hasta_dia: 20,
      monto_por_dia_usd: 120,
      vigente_desde: "2026-06-01",
      vigente_hasta: null,
      notas: "prueba",
    };
    await crearDemoraVenta(input);
    const payload = getMutationPayload(TABLE, "insert") as typeof input;
    expect(payload.tipo_contenedor_id).toBe("tc-99");
    expect(payload.monto_por_dia_usd).toBe(120);
  });

  it("07 — crearDemoraVenta: lanza error si Supabase falla", async () => {
    setTableResult(TABLE, { data: null, error: new Error("insert fail") });
    const input: DemoraVentaTarifaInput = {
      tipo_contenedor_id: "tc-1",
      desde_dia: 1,
      hasta_dia: null,
      monto_por_dia_usd: 10,
      vigente_desde: "2026-01-01",
      vigente_hasta: null,
      notas: null,
    };
    await expect(crearDemoraVenta(input)).rejects.toThrow("insert fail");
  });

  it("08 — eliminarDemoraVenta: hace delete + eq con el id dado", async () => {
    setTableResult(TABLE, { data: null, error: null });
    await eliminarDemoraVenta("abc-123");
    const call = tableCalls[0];
    expect(call.ops).toContain("delete");
    expect(call.ops).toContain("eq");
    const eqIdx = call.ops.indexOf("eq");
    expect(call.opArgs[eqIdx]).toEqual(["id", "abc-123"]);
  });

  it("09 — eliminarDemoraVenta: lanza error si Supabase falla", async () => {
    setTableResult(TABLE, { data: null, error: new Error("delete fail") });
    await expect(eliminarDemoraVenta("x")).rejects.toThrow("delete fail");
  });

  it("10 — fetchDemorasVenta: fila con hasta_dia null se preserva", async () => {
    setTableResult(TABLE, { data: [makeRow({ hasta_dia: null })], error: null });
    const [row] = await fetchDemorasVenta();
    expect(row.hasta_dia).toBeNull();
  });
});
