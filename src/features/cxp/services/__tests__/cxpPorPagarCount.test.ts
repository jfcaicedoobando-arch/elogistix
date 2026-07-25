import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchPorPagarCount } from "../cxpPorPagarCount";

describe("cxpPorPagarCount service", () => {
  beforeEach(() => {
    mock.rpcCalls.length = 0;
  });

  it("retorna la cantidad de filas devueltas por la RPC", async () => {
    mock.setRpcResult("cxp_por_pagar", {
      data: [{ factura_id: "a" }, { factura_id: "b" }, { factura_id: "c" }],
      error: null,
    });
    await expect(fetchPorPagarCount()).resolves.toBe(3);
    expect(mock.rpcCalls[0].fn).toBe("cxp_por_pagar");
  });

  it("retorna 0 cuando la RPC devuelve null", async () => {
    mock.setRpcResult("cxp_por_pagar", { data: null, error: null });
    await expect(fetchPorPagarCount()).resolves.toBe(0);
  });

  it("[cxpPorPagarCount] propaga el error", async () => {
    mock.setRpcResult("cxp_por_pagar", { data: null, error: { message: "rls" } });
    await expect(fetchPorPagarCount()).rejects.toMatchObject({ message: "rls" });
  });
});
