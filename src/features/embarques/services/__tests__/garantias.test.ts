import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchGarantiasEmbarque, updateGarantia } from "../garantias";
import { GarantiaError } from "../garantiasErrors";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("embarques/services/garantias", () => {
  it("garantias.fetch: devuelve [] sin data", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: null, error: null });
    const r = await fetchGarantiasEmbarque("emb-1");
    expect(r).toEqual([]);
  });

  it("garantias.fetch: filtra por embarque_id con eq", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: [], error: null });
    await fetchGarantiasEmbarque("emb-1");
    const call = mock.tableCalls.find((c) => c.table === "embarque_garantias_contenedor");
    expect(call?.ops).toContain("eq");
    expect(call?.opArgs[call.ops.indexOf("eq")]).toEqual(["embarque_id", "emb-1"]);
  });

  it("garantias.fetch: propaga error de supabase", async () => {
    mock.setTableResult("embarque_garantias_contenedor", { data: null, error: { message: "rls" } });
    await expect(fetchGarantiasEmbarque("e")).rejects.toThrow();
  });

  it("garantias.update: invoca RPC set_garantia_estado con todos los args", async () => {
    mock.setRpcResult("set_garantia_estado", { data: null, error: null });
    await updateGarantia({
      id: "g1",
      estado: "depositado",
      fecha_deposito: "2026-06-10",
      monto_deposito_usd: 1500,
      referencia_deposito: "REF-1",
      notas: "Pago BBVA",
    });
    const call = mock.rpcCalls.find((c) => c.fn === "set_garantia_estado");
    expect(call).toBeTruthy();
    const args = call!.args as Record<string, unknown>;
    expect(args.p_id).toBe("g1");
    expect(args.p_estado).toBe("depositado");
    expect(args.p_fecha_deposito).toBe("2026-06-10");
    expect(args.p_monto).toBe(1500);
    expect(args.p_referencia).toBe("REF-1");
    expect(args.p_notas).toBe("Pago BBVA");
  });

  it("garantias.update: manda null para campos no provistos", async () => {
    mock.setRpcResult("set_garantia_estado", { data: null, error: null });
    await updateGarantia({ id: "g1", estado: "liberado" });
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_fecha_liberacion).toBeNull();
    expect(args.p_monto).toBeNull();
  });

  it("garantias.update: mapea LC_GARANTIA_TRANSICION_INVALIDA a mensaje amigable", async () => {
    mock.setRpcResult("set_garantia_estado", {
      data: null,
      error: { message: "LC_GARANTIA_TRANSICION_INVALIDA: pendiente -> liberado" },
    });
    await expect(updateGarantia({ id: "g1", estado: "liberado" })).rejects.toMatchObject({
      code: "LC_GARANTIA_TRANSICION_INVALIDA",
    });
  });

  it("garantias.update: mapea LC_GARANTIA_MONTO_CONGELADO", async () => {
    mock.setRpcResult("set_garantia_estado", {
      data: null,
      error: { message: "LC_GARANTIA_MONTO_CONGELADO" },
    });
    const err = await updateGarantia({ id: "g1", monto_deposito_usd: 999 }).catch((e) => e);
    expect(err).toBeInstanceOf(GarantiaError);
    expect((err as GarantiaError).code).toBe("LC_GARANTIA_MONTO_CONGELADO");
  });

  it("garantias.update: mapea LC_GARANTIA_SIN_ROL", async () => {
    mock.setRpcResult("set_garantia_estado", {
      data: null,
      error: { message: "LC_GARANTIA_SIN_ROL" },
    });
    await expect(updateGarantia({ id: "g1", estado: "depositado" })).rejects.toMatchObject({
      code: "LC_GARANTIA_SIN_ROL",
    });
  });

  it("garantias.update: error desconocido se envuelve como UNKNOWN", async () => {
    mock.setRpcResult("set_garantia_estado", {
      data: null,
      error: { message: "boom raro" },
    });
    const err = await updateGarantia({ id: "g1", estado: "depositado" }).catch((e) => e);
    expect((err as GarantiaError).code).toBe("UNKNOWN");
  });
});
