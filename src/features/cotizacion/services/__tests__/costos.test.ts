import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchCotizacionCostos,
  upsertCotizacionCostos,
  fetchCotizacionCostosForEmbarque,
} from "@/features/cotizacion/services/costos";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("services/cotizacion/costos", () => {
  it("fetchCotizacionCostos devuelve filas", async () => {
    mock.setTableResult("cotizacion_costos", { data: [{ id: "c1" }], error: null });
    const r = await fetchCotizacionCostos("cot-1");
    expect(r).toHaveLength(1);
  });

  it("fetchCotizacionCostos devuelve [] cuando data es null", async () => {
    mock.setTableResult("cotizacion_costos", { data: null, error: null });
    const r = await fetchCotizacionCostos("cot-1");
    expect(r).toEqual([]);
  });

  it("fetchCotizacionCostos propaga error", async () => {
    mock.setTableResult("cotizacion_costos", { data: null, error: { message: "x" } });
    await expect(fetchCotizacionCostos("cot-1")).rejects.toThrow();
  });

  it("fetchCotizacionCostos filtra por cotizacion_id", async () => {
    mock.setTableResult("cotizacion_costos", { data: [], error: null });
    await fetchCotizacionCostos("cot-123");
    const call = mock.tableCalls.find((c) => c.table === "cotizacion_costos");
    const eqIdx = call!.ops.indexOf("eq");
    expect(call!.opArgs[eqIdx]).toEqual(["cotizacion_id", "cot-123"]);
  });

  it("upsertCotizacionCostos invoca RPC con payload mapeado", async () => {
    mock.setRpcResult("actualizar_cotizacion_costos", { data: null, error: null });
    mock.setTableResult("cotizacion_costos", { data: [], error: null });
    await upsertCotizacionCostos("cot-1", [
      {
        concepto: "Flete",
        moneda: "USD",
        proveedor: "ACME",
        cantidad: 1,
        costo_unitario: 100,
        precio_venta: 120,
      } as never,
    ], "req-1");
    expect(mock.rpcCalls[0].fn).toBe("actualizar_cotizacion_costos");
    expect(mock.rpcCalls[0].args).toMatchObject({
      p_cotizacion_id: "cot-1",
      p_request_id: "req-1",
    });
  });

  it("upsertCotizacionCostos defaults para campos opcionales", async () => {
    mock.setRpcResult("actualizar_cotizacion_costos", { data: null, error: null });
    mock.setTableResult("cotizacion_costos", { data: [], error: null });
    await upsertCotizacionCostos("cot-1", [
      { concepto: "X", moneda: "MXN", proveedor: "P", cantidad: 1, costo_unitario: 10 } as never,
    ]);
    const args = mock.rpcCalls[0].args as { p_costos: Array<Record<string, unknown>> };
    expect(args.p_costos[0]).toMatchObject({ precio_venta: 0, unidad_medida: "", notas: "" });
  });

  it("upsertCotizacionCostos propaga error del RPC", async () => {
    mock.setRpcResult("actualizar_cotizacion_costos", { data: null, error: { message: "boom" } });
    await expect(
      upsertCotizacionCostos("cot-1", []),
    ).rejects.toThrow();
  });

  it("fetchCotizacionCostosForEmbarque devuelve filas tipadas", async () => {
    mock.setTableResult("cotizacion_costos", {
      data: [{ concepto: "F", costo_unitario: 100, moneda: "USD", proveedor: "P" }],
      error: null,
    });
    const r = await fetchCotizacionCostosForEmbarque("cot-1");
    expect(r[0].concepto).toBe("F");
  });

  it("fetchCotizacionCostosForEmbarque lanza error.message", async () => {
    mock.setTableResult("cotizacion_costos", { data: null, error: { message: "fail" } });
    await expect(fetchCotizacionCostosForEmbarque("cot-1")).rejects.toThrow(/fail/);
  });
});
