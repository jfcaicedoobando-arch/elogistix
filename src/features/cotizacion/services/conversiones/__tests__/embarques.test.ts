/**
 * Ola 4 · N17: `crear_embarque_borrador_desde_cotizacion` es la RPC 1-arg
 * (`p_cotizacion_id`). El wrapper duplicado que mandaba parámetros obsoletos
 * (`p_tarifa_aplicada`/`p_delta`) fue eliminado; este test evita que alguien
 * vuelva a agregarle argumentos a la llamada real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

const revalidarTarifaMock = vi.fn();
vi.mock("@/features/cotizacion/services/revalidacion", () => ({
  revalidarTarifa: (...args: unknown[]) => revalidarTarifaMock(...args),
}));

const registrarActividadMock = vi.fn();
vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: (...args: unknown[]) => registrarActividadMock(...args),
}));

import { crearEmbarqueBorradorDesdeCotizacion } from "../embarques";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
  revalidarTarifaMock.mockReset();
  registrarActividadMock.mockReset();
  revalidarTarifaMock.mockResolvedValue({ severidad: "sin_cambios" });
});

describe("crearEmbarqueBorradorDesdeCotizacion (Ola 4 · N17)", () => {
  it("invoca la RPC únicamente con { p_cotizacion_id }, sin parámetros obsoletos", async () => {
    mock.setTableResult("cotizaciones", { data: { tipo_documento: "formal" }, error: null });
    mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", { data: "emb-1", error: null });

    const id = await crearEmbarqueBorradorDesdeCotizacion("cot-1");

    expect(id).toBe("emb-1");
    expect(mock.rpcCalls).toHaveLength(1);
    expect(mock.rpcCalls[0].fn).toBe("crear_embarque_borrador_desde_cotizacion");
    expect(mock.rpcCalls[0].args).toEqual({ p_cotizacion_id: "cot-1" });
  });

  it("bloquea la conversión de cotizaciones informativas antes de llamar a la RPC", async () => {
    mock.setTableResult("cotizaciones", { data: { tipo_documento: "informativa" }, error: null });
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-2")).rejects.toThrow(/informativas/);
    expect(mock.rpcCalls).toHaveLength(0);
  });

  it("propaga error de la RPC mapeado a LC_COT_ESTADO_INVALIDO", async () => {
    mock.setTableResult("cotizaciones", { data: { tipo_documento: "formal" }, error: null });
    mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", {
      data: null,
      error: { message: "LC_COT_ESTADO_INVALIDO: estado no válido" },
    });
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-3")).rejects.toThrow(
      /Solo se pueden convertir/,
    );
  });
});
