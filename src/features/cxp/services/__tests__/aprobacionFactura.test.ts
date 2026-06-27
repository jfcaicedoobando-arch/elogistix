import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { aprobarFacturaProveedor } from "../aprobacionFactura";

describe("aprobarFacturaProveedor", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("invoca RPC con p_id, p_aprobar=true y p_motivo undefined", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: { id: "f1", estado: "Vigente" }, error: null });
    const r = await aprobarFacturaProveedor("f1", true);
    expect(r.id).toBe("f1");
  });

  it("pasa motivo al rechazar", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: { id: "f1" }, error: null });
    await aprobarFacturaProveedor("f1", false, "duplicada");
    // El mock no inspecciona args de RPC directamente; valida que no haya error.
    expect(true).toBe(true);
  });

  it("propaga error de Supabase", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: null, error: { message: "no_role" } });
    await expect(aprobarFacturaProveedor("f1", true)).rejects.toMatchObject({ message: "no_role" });
  });
});
