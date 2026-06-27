import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchPendientesAprobacionCount } from "../cxpAprobacionCount";

describe("cxpAprobacionCount service", () => {
  beforeEach(() => {
    mock.rpcCalls.length = 0;
  });

  it("retorna el conteo numérico de la RPC", async () => {
    mock.setRpcResult("cxp_pendientes_aprobacion_count", { data: 7, error: null });
    await expect(fetchPendientesAprobacionCount()).resolves.toBe(7);
    expect(mock.rpcCalls[0].fn).toBe("cxp_pendientes_aprobacion_count");
  });

  it("retorna 0 cuando la RPC devuelve null", async () => {
    mock.setRpcResult("cxp_pendientes_aprobacion_count", { data: null, error: null });
    await expect(fetchPendientesAprobacionCount()).resolves.toBe(0);
  });

  it("[cxpAprobacionCount] propaga el error", async () => {
    mock.setRpcResult("cxp_pendientes_aprobacion_count", { data: null, error: { message: "rls" } });
    await expect(fetchPendientesAprobacionCount()).rejects.toMatchObject({ message: "rls" });
  });
});
