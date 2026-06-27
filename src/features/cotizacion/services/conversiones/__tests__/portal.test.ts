import { describe, it, expect, beforeEach, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { portalResponderCotizacion } from "@/features/cotizacion/services/conversiones/portal";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("portalResponderCotizacion", () => {
  it("invoca la RPC portal_responder_cotizacion con los argumentos correctos", async () => {
    mock.setRpcResult("portal_responder_cotizacion", { data: null, error: null });
    await portalResponderCotizacion("cot-1", "Aceptada", "ok");
    const call = mock.rpcCalls.find((c) => c.fn === "portal_responder_cotizacion");
    expect(call?.args).toEqual({
      p_cotizacion_id: "cot-1",
      p_respuesta: "Aceptada",
      p_comentario: "ok",
    });
  });

  it("propaga error cuando la RPC falla", async () => {
    mock.setRpcResult("portal_responder_cotizacion", {
      data: null,
      error: new Error("rpc-failed"),
    });
    await expect(
      portalResponderCotizacion("cot-2", "Rechazada", ""),
    ).rejects.toThrow("rpc-failed");
  });
});
