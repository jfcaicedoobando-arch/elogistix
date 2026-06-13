/**
 * demorasVenta — extra tests (Supabase mock)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DemoraVentaTarifaInput } from "../demorasVenta";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchDemorasVenta, crearDemoraVenta, eliminarDemoraVenta } from "../demorasVenta";

const TABLE = "costeo_demoras_venta_tarifa";

function makeRow(o: Record<string, unknown> = {}) {
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
  mock.tableCalls.length = 0;
  mock.setTableResult(TABLE, { data: null, error: null });
});

describe("costeo/demorasVenta (extra)", () => {
  it("01 — fetchDemorasVenta: retorna arreglo vacío cuando data es null", async () => {
    mock.setTableResult(TABLE, { data: null, error: null });
    const res = await fetchDemorasVenta();
    expect(res).toEqual([]);
  });

  it("02 — fetchDemorasVenta: retorna las filas mapeadas", async () => {
    const rows = [makeRow(), makeRow({ id: "row-2", desde_dia: 11 })];
    mock.setTableResult(TABLE, { data: rows, error: null });
    const res = await fetchDemorasVenta();
    expect(res).toHaveLength(2);
    expect(res[1].desde_dia).toBe(11);
  });

  it("03 — fetchDemorasVenta: lanza el error de Supabase", async () => {
    mock.setTableResult(TABLE, { data: null, error: new Error("DB error") });
    await expect(fetchDemorasVenta()).rejects.toThrow("DB error");
  });

  it("04 — fetchDemorasVenta: llama a from con la tabla correcta", async () => {
    mock.setTableResult(TABLE, { data: [], error: null });
    await fetchDemorasVenta();
    expect(mock.tableCalls[0].table).toBe(TABLE);
  });

  it("05 — fetchDemorasVenta: incluye doble operación order", async () => {
    mock.setTableResult(TABLE, { data: [], error: null });
    await fetchDemorasVenta();
    const orderCount = mock.tableCalls[0].ops.filter((o) => o === "order").length;
    expect(orderCount).toBe(2);
  });

  it("06 — crearDemoraVenta: inserta el payload correcto", async () => {
    mock.setTableResult(TABLE, { data: null, error: null });
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
    const payload = mock.getMutationPayload(TABLE, "insert") as Record<string, unknown>;
    expect(payload.tipo_contenedor_id).toBe("tc-99");
    expect(payload.monto_por_dia_usd).toBe(120);
  });

  it("07 — crearDemoraVenta: lanza error si Supabase falla", async () => {
    mock.setTableResult(TABLE, { data: null, error: new Error("insert fail") });
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
    mock.setTableResult(TABLE, { data: null, error: null });
    await eliminarDemoraVenta("abc-123");
    const call = mock.tableCalls[0];
    expect(call.ops).toContain("delete");
    expect(call.ops).toContain("eq");
    const eqIdx = call.ops.indexOf("eq");
    expect(call.opArgs[eqIdx]).toEqual(["id", "abc-123"]);
  });

  it("09 — eliminarDemoraVenta: lanza error si Supabase falla", async () => {
    mock.setTableResult(TABLE, { data: null, error: new Error("delete fail") });
    await expect(eliminarDemoraVenta("x")).rejects.toThrow("delete fail");
  });

  it("10 — fetchDemorasVenta: fila con hasta_dia null se preserva", async () => {
    mock.setTableResult(TABLE, { data: [makeRow({ hasta_dia: null })], error: null });
    const [row] = await fetchDemorasVenta();
    expect(row.hasta_dia).toBeNull();
  });
});
