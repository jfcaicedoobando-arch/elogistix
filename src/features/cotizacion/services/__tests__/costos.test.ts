import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchCotizacionCostos,
  fetchCotizacionCostosSnapshot,
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

  it("fetchCotizacionCostosSnapshot devuelve filas y sello de una sola lectura", async () => {
    mock.setTableResult("cotizaciones", {
      data: { updated_at: "2026-09-03T12:00:00Z", cotizacion_costos: [] },
      error: null,
    });
    const r = await fetchCotizacionCostosSnapshot("cot-1");
    expect(r).toEqual({ costos: [], updatedAt: "2026-09-03T12:00:00Z" });
    const call = mock.tableCalls.find((c) => c.table === "cotizaciones");
    expect(call?.opArgs[call.ops.indexOf("select")]).toEqual([
      "updated_at, cotizacion_costos(*)",
    ]);
  });

  it("upsertCotizacionCostos invoca RPC con payload mapeado", async () => {
    mock.setRpcResult("actualizar_cotizacion_costos", { data: null, error: null });
    mock.setTableResult("cotizaciones", {
      data: { updated_at: "2026-09-03T12:00:00Z", cotizacion_costos: [] }, error: null,
    });
    await upsertCotizacionCostos("cot-1", [
      {
        concepto: "Flete",
        moneda: "USD",
        proveedor: "ACME",
        cantidad: 1,
        costo_unitario: 100,
        precio_venta: 120,
      } as never,
    ], "req-1", "2026-09-03T11:00:00Z");
    expect(mock.rpcCalls[0].fn).toBe("actualizar_cotizacion_costos");
    expect(mock.rpcCalls[0].args).toMatchObject({
      p_cotizacion_id: "cot-1",
      p_request_id: "req-1",
    });
  });

  it("upsertCotizacionCostos defaults para campos opcionales", async () => {
    mock.setRpcResult("actualizar_cotizacion_costos", { data: null, error: null });
    mock.setTableResult("cotizaciones", {
      data: { updated_at: "2026-09-03T12:00:00Z", cotizacion_costos: [] }, error: null,
    });
    await upsertCotizacionCostos("cot-1", [
      { concepto: "X", moneda: "MXN", proveedor: "P", cantidad: 1, costo_unitario: 10 } as never,
    ], "req-2", "2026-09-03T11:00:00Z");
    const args = mock.rpcCalls[0].args as { p_costos: Array<Record<string, unknown>> };
    expect(args.p_costos[0]).toMatchObject({ precio_venta: 0, unidad_medida: "", notas: "" });
  });

  it("upsertCotizacionCostos propaga error del RPC", async () => {
    mock.setRpcResult("actualizar_cotizacion_costos", { data: null, error: { message: "boom" } });
    await expect(
      upsertCotizacionCostos("cot-1", [], "req-3", "2026-09-03T11:00:00Z"),
    ).rejects.toThrow();
  });

  it("upsertCotizacionCostos devuelve el sello nuevo de la cotización", async () => {
    mock.setRpcResult("actualizar_cotizacion_costos", {
      data: { cotizacion_id: "cot-1", count: 1, updated_at: "2026-09-03T12:00:00Z" },
      error: null,
    });
    mock.setTableResult("cotizaciones", {
      data: { updated_at: "2026-09-03T12:00:00Z", cotizacion_costos: [] }, error: null,
    });
    const r = await upsertCotizacionCostos("cot-1", [], "req-1", "2026-09-03T11:00:00Z");
    expect(mock.rpcCalls[0].args).toMatchObject({ p_expected_updated_at: "2026-09-03T11:00:00Z" });
    expect(r.updatedAt).toBe("2026-09-03T12:00:00Z");
    expect(r.snapshot).toEqual({ costos: [], updatedAt: "2026-09-03T12:00:00Z" });
  });

  // v13.823.169: la RPC confirma S1 (escritura propia) y la relectura devuelve
  // S2 porque alguien más tocó la cotización en medio. El sello de escritura NO
  // se contamina con S2 (si lo hiciera, el wizard avanzaría su candado a ciegas
  // y podría pisar el cambio ajeno), y la fotografía queda coherente en S2.
  it("upsertCotizacionCostos separa el sello de escritura (S1) de la fotografía (S2)", async () => {
    mock.setRpcResult("actualizar_cotizacion_costos", {
      data: { cotizacion_id: "cot-1", count: 1, updated_at: "2026-09-03T12:00:00Z" },
      error: null,
    });
    mock.setTableResult("cotizaciones", {
      data: { updated_at: "2026-09-03T12:30:00Z", cotizacion_costos: [] }, error: null,
    });
    const r = await upsertCotizacionCostos("cot-1", [], "req-1", "2026-09-03T11:00:00Z");
    expect(r.updatedAt).toBe("2026-09-03T12:00:00Z");
    expect(r.snapshot.updatedAt).toBe("2026-09-03T12:30:00Z");
  });

  it("upsertCotizacionCostos lanza LC_CONFLICTO_CONCURRENCIA y no relee costos", async () => {
    mock.setRpcResult("actualizar_cotizacion_costos", {
      data: null,
      error: { message: "LC_CONFLICTO_CONCURRENCIA: otro usuario modificó esta cotización." },
    });
    await expect(
      upsertCotizacionCostos("cot-1", [], "req-1", "2026-09-03T11:00:00Z"),
    ).rejects.toThrow(/LC_CONFLICTO_CONCURRENCIA/);
    expect(mock.tableCalls.some((c) => c.table === "cotizacion_costos")).toBe(false);
  });

  it("upsertCotizacionCostos sin sello no llama la RPC (falla cerrada)", async () => {
    await expect(upsertCotizacionCostos("cot-1", [], "req-4")).rejects.toThrow(
      /LC_CONFLICTO_CONCURRENCIA/,
    );
    expect(mock.rpcCalls.length).toBe(0);
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
