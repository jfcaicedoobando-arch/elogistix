import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchProveedorEstadoCuenta } from "@/features/proveedor/services/estadoCuenta";
import { fetchProveedorMovimientos } from "@/features/proveedor/services/estadoCuentaMovimientos";

beforeEach(() => {
  mock.rpcCalls.length = 0;
});

describe("fetchProveedorEstadoCuenta", () => {
  it("devuelve vacío sin id sin llamar a la base", async () => {
    const res = await fetchProveedorEstadoCuenta("");
    expect(res).toEqual({ partidas: [], facturas_huerfanas: [] });
    expect(mock.rpcCalls).toHaveLength(0);
  });

  it("llama a la función con el proveedor y normaliza la respuesta nula", async () => {
    mock.setRpcResult("proveedor_estado_cuenta", { data: null, error: null });
    const res = await fetchProveedorEstadoCuenta("p1");
    expect(mock.rpcCalls[0]).toMatchObject({
      fn: "proveedor_estado_cuenta",
      args: { p_proveedor_id: "p1" },
    });
    expect(res).toEqual({ partidas: [], facturas_huerfanas: [] });
  });

  it("propaga el error de la base", async () => {
    mock.setRpcResult("proveedor_estado_cuenta", { data: null, error: { message: "boom" } });
    await expect(fetchProveedorEstadoCuenta("p1")).rejects.toMatchObject({ message: "boom" });
  });
});

describe("fetchProveedorMovimientos", () => {
  it("envía el rango de fechas al servidor", async () => {
    mock.setRpcResult("proveedor_estado_cuenta_movimientos", {
      data: { movimientos: [], aging: [], saldos: [] },
      error: null,
    });
    await fetchProveedorMovimientos("p1", "2026-01-01", "2026-01-31");
    expect(mock.rpcCalls[0].args).toEqual({
      p_proveedor_id: "p1",
      p_desde: "2026-01-01",
      p_hasta: "2026-01-31",
    });
  });

  it("manda null cuando no hay rango", async () => {
    mock.setRpcResult("proveedor_estado_cuenta_movimientos", { data: null, error: null });
    const res = await fetchProveedorMovimientos("p1");
    expect(mock.rpcCalls[0].args).toEqual({
      p_proveedor_id: "p1",
      p_desde: undefined,
      p_hasta: undefined,
    });
    expect(res).toEqual({ movimientos: [], aging: [], saldos: [] });
  });

  it("propaga el error de la base", async () => {
    mock.setRpcResult("proveedor_estado_cuenta_movimientos", {
      data: null,
      error: { message: "sin org" },
    });
    await expect(fetchProveedorMovimientos("p1")).rejects.toMatchObject({ message: "sin org" });
  });
});
