import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchLiquidaciones, generarLiquidacion, registrarPagoLiquidacion } from "../liquidaciones";

describe("liquidaciones service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
  });

  it("fetchLiquidaciones lista registros", async () => {
    mock.setTableResult("liquidaciones_comision", { data: [{ id: "l1" }], error: null });
    const res = await fetchLiquidaciones();
    expect(res.length).toBe(1);
  });

  it("generarLiquidacion llama al RPC", async () => {
    mock.setRpcResult("generar_liquidacion_comision", { data: "l1", error: null });
    const res = await generarLiquidacion({ vendedora_id: "v1", periodo: "2024-01", organization_id: "o1" });
    expect(res).toBe("l1");
    expect(mock.rpcCalls[0].fn).toBe("generar_liquidacion_comision");
  });

  it("registrarPagoLiquidacion hace update", async () => {
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });
    await registrarPagoLiquidacion({ id: "l1", fecha_pago: "2024-01-01", metodo_pago: "Cash", referencia: "REF" });
    const call = mock.tableCalls.find(c => c.table === "liquidaciones_comision");
    expect(call?.ops).toContain("update");
  });
});
