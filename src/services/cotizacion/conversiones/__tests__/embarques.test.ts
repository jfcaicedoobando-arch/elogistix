/**
 * Tests para el wrapper RPC `crearEmbarqueBorradorDesdeCotizacion` (feature 12.30.0).
 * El orquestador `convertirCotizacionAEmbarques` involucra 5+ tablas en secuencia
 * y se valida vía E2E (spec 07-cotizacion-conversion.spec.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { crearEmbarqueBorradorDesdeCotizacion } from "../embarques";

beforeEach(() => {
  mock.rpcCalls.length = 0;
});

describe("crearEmbarqueBorradorDesdeCotizacion", () => {
  it("devuelve el id de embarque que regresa la RPC", async () => {
    mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", {
      data: "emb-new-1",
      error: null,
    });
    const r = await crearEmbarqueBorradorDesdeCotizacion("cot-1");
    expect(r).toBe("emb-new-1");
    expect(mock.rpcCalls[0]).toEqual({
      fn: "crear_embarque_borrador_desde_cotizacion",
      args: { p_cotizacion_id: "cot-1" },
    });
  });

  it("propaga error de la RPC", async () => {
    mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", {
      data: null,
      error: { message: "no permitido" },
    });
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-1")).rejects.toBeTruthy();
  });

  it("lanza si la RPC devuelve null sin error (caso defensivo)", async () => {
    mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", {
      data: null,
      error: null,
    });
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-1")).rejects.toThrow(
      /no devolvió un embarque/,
    );
  });
});
