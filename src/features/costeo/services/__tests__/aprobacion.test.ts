/**
 * Tests de aprobación/rechazo/reactivación de tarifas marítimas.
 * Verifica los parámetros del RPC y la validación de motivo de rechazo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { aprobarTarifa, rechazarTarifa, reactivarTarifa } from "../aprobacion";

beforeEach(() => {
  mock.rpcCalls.length = 0;
  mock.setRpcResult("agente_aprobar_tarifa", { data: null, error: null });
});

describe("costeo/services/aprobacion", () => {
  it("aprobarTarifa llama RPC con estado 'vigente' y motivo null", async () => {
    await aprobarTarifa("t1");
    const call = mock.rpcCalls.find((c) => c.fn === "agente_aprobar_tarifa");
    expect(call?.args).toMatchObject({ _tarifa_id: "t1", _estado: "vigente", _motivo: undefined });
  });

  it("rechazarTarifa envía estado 'rechazada' con motivo recortado", async () => {
    await rechazarTarifa("t2", "   motivo válido   ");
    const call = mock.rpcCalls.find((c) => c.fn === "agente_aprobar_tarifa");
    expect(call?.args).toMatchObject({ _tarifa_id: "t2", _estado: "rechazada", _motivo: "motivo válido" });
  });

  it("rechazarTarifa rechaza motivo < 5 caracteres antes de llamar RPC", async () => {
    await expect(rechazarTarifa("t3", "no")).rejects.toThrow(/al menos 5/);
    expect(mock.rpcCalls.find((c) => c.fn === "agente_aprobar_tarifa")).toBeUndefined();
  });

  it("rechazarTarifa rechaza motivo que tras trim queda corto", async () => {
    await expect(rechazarTarifa("t4", "   ab   ")).rejects.toThrow(/al menos 5/);
  });

  it("reactivarTarifa devuelve la tarifa a 'borrador'", async () => {
    await reactivarTarifa("t5");
    const call = mock.rpcCalls.find((c) => c.fn === "agente_aprobar_tarifa");
    expect(call?.args).toMatchObject({ _tarifa_id: "t5", _estado: "borrador", _motivo: undefined });
  });

  it("propaga errores del RPC", async () => {
    mock.setRpcResult("agente_aprobar_tarifa", { data: null, error: { message: "denied" } });
    await expect(aprobarTarifa("t6")).rejects.toThrow();
  });
});
