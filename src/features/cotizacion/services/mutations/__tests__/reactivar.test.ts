import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

const { registrarActividadMock } = vi.hoisted(() => ({
  registrarActividadMock: vi.fn(async () => undefined),
}));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: registrarActividadMock }));

import { reactivarCotizacion } from "../reactivar";

beforeEach(() => {
  mock.resetResults();
  mock.rpcCalls.length = 0;
  mock.tableCalls.length = 0;
  registrarActividadMock.mockClear();
});

describe("reactivarCotizacion", () => {
  it("Ola 6 · A3: delega en reactivar_cotizacion_rpc y no toca la tabla directamente", async () => {
    mock.setRpcResult("reactivar_cotizacion_rpc", { data: "Borrador", error: null });
    const estado = await reactivarCotizacion("cot-1");
    expect(estado).toBe("Borrador");
    const call = mock.rpcCalls.find((c) => c.fn === "reactivar_cotizacion_rpc");
    expect(call?.args).toEqual({ p_id: "cot-1" });
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("registra la actividad con el estado devuelto por la RPC", async () => {
    mock.setRpcResult("reactivar_cotizacion_rpc", { data: "Enviada", error: null });
    await reactivarCotizacion("cot-2");
    expect(registrarActividadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modulo: "cotizaciones",
        entidadId: "cot-2",
        detalles: { estado_nuevo: "Enviada" },
      }),
    );
  });

  it("usa 'Borrador' cuando la RPC no devuelve estado", async () => {
    mock.setRpcResult("reactivar_cotizacion_rpc", { data: null, error: null });
    await expect(reactivarCotizacion("cot-3")).resolves.toBe("Borrador");
  });

  it("propaga el error de reactivar_cotizacion_rpc y no registra actividad", async () => {
    mock.setRpcResult("reactivar_cotizacion_rpc", {
      data: null,
      error: { message: "LC_COTIZACION_ESTADO_INVALIDO" },
    });
    await expect(reactivarCotizacion("cot-4")).rejects.toThrow(/LC_COTIZACION_ESTADO_INVALIDO/);
    expect(registrarActividadMock).not.toHaveBeenCalled();
  });
});
