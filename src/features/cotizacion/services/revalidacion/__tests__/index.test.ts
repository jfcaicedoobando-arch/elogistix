import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  revalidarTarifa,
  solicitarReaprobacionVentas,
  resolverReaprobacion,
  crearEmbarqueBorradorConDecision,
} from "@/features/cotizacion/services/revalidacion";

beforeEach(() => {
  mock.rpcCalls.length = 0;
  mock.tableCalls.length = 0;
});

describe("revalidarTarifa", () => {
  it("parsea el payload de la RPC a ResultadoRevalidacion tipado", async () => {
    mock.setRpcResult("revalidar_tarifa_cotizacion", {
      data: {
        tarifa_vigente: true,
        agente_sin_cupo: false,
        severidad: "informativa",
        cambios: [
          { concepto: "Flete", moneda: "USD", monto_anterior: 100, monto_actual: 103, delta_abs: 3, delta_pct: 3 },
        ],
        umbral_pct: 5,
        max_delta_pct: 3,
      },
      error: null,
    });
    const out = await revalidarTarifa("cot-1");
    expect(out.severidad).toBe("informativa");
    expect(out.cambios).toHaveLength(1);
    expect(out.cambios[0].moneda).toBe("USD");
    expect(out.max_delta_pct).toBe(3);
  });

  it("acepta payloads vacíos sin lanzar", async () => {
    mock.setRpcResult("revalidar_tarifa_cotizacion", { data: null, error: null });
    const out = await revalidarTarifa("cot-2");
    expect(out.severidad).toBe("sin_cambios");
    expect(out.cambios).toEqual([]);
  });

  it("propaga error de la RPC revalidar_tarifa_cotizacion", async () => {
    mock.setRpcResult("revalidar_tarifa_cotizacion", { data: null, error: { message: "boom" } });
    await expect(revalidarTarifa("cot-3")).rejects.toThrow("boom");
  });
});

describe("solicitarReaprobacionVentas", () => {
  it("invoca la RPC con el delta", async () => {
    mock.setRpcResult("solicitar_reaprobacion_tarifa", { data: null, error: null });
    await solicitarReaprobacionVentas("cot-1", { foo: 1 });
    const call = mock.rpcCalls.find((c) => c.fn === "solicitar_reaprobacion_tarifa");
    expect(call).toBeTruthy();
    expect((call!.args as { p_delta_jsonb: unknown }).p_delta_jsonb).toEqual({ foo: 1 });
  });
  it("propaga error de solicitarReaprobacionVentas", async () => {
    mock.setRpcResult("solicitar_reaprobacion_tarifa", { data: null, error: { message: "x" } });
    await expect(solicitarReaprobacionVentas("c", {})).rejects.toThrow("x");
  });
});

describe("resolverReaprobacion", () => {
  it("envía decision reaprobada/rechazada", async () => {
    mock.setRpcResult("resolver_reaprobacion_tarifa", { data: null, error: null });
    await resolverReaprobacion("cot-9", "reaprobada");
    const call = mock.rpcCalls.find((c) => c.fn === "resolver_reaprobacion_tarifa");
    expect((call!.args as { p_decision: string }).p_decision).toBe("reaprobada");
  });
});

describe("crearEmbarqueBorradorConDecision", () => {
  it("devuelve el id del embarque y manda los 4 parámetros", async () => {
    mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", {
      data: "emb-42",
      error: null,
    });
    const id = await crearEmbarqueBorradorConDecision("cot-1", "refrescada", "tar-2", { d: 1 });
    expect(id).toBe("emb-42");
    const args = mock.rpcCalls.find((c) => c.fn === "crear_embarque_borrador_desde_cotizacion")
      ?.args as Record<string, unknown>;
    expect(args.p_decision).toBe("refrescada");
    expect(args.p_tarifa_id_aplicada).toBe("tar-2");
    expect(args.p_delta_jsonb).toEqual({ d: 1 });
  });

  it("falla si crearEmbarqueBorradorConDecision no devuelve id", async () => {
    mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", { data: null, error: null });
    await expect(
      crearEmbarqueBorradorConDecision("cot-1", "sin_cambios", null, null),
    ).rejects.toThrow();
  });
});
