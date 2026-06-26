import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchFacturasParaZip, marcarFacturasComoEnviadas } from "../masivas";

describe("masivas service", () => {
  beforeEach(() => { mock.tableCalls.length = 0; });

  it("fetchFacturasParaZip cortocircuita con array vacío", async () => {
    const res = await fetchFacturasParaZip([]);
    expect(res).toEqual([]);
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("fetchFacturasParaZip devuelve filas y aplica IN(ids)", async () => {
    const rows = [{ id: "1", numero: "F-1", factura_pdf_url: null, factura_xml_url: null }];
    mock.setTableResult("facturas", { data: rows, error: null });
    const res = await fetchFacturasParaZip(["1", "2"]);
    expect(res).toEqual(rows);
    const call = mock.tableCalls[0];
    expect(call.table).toBe("facturas");
    expect(call.opArgs[call.ops.indexOf("in")]).toEqual(["id", ["1", "2"]]);
  });

  it("fetchFacturasParaZip propaga error de Supabase", async () => {
    mock.setTableResult("facturas", { data: null, error: new Error("nope") });
    await expect(fetchFacturasParaZip(["1"])).rejects.toThrow("nope");
  });

  it("marcarFacturasComoEnviadas cortocircuita con []", async () => {
    await marcarFacturasComoEnviadas([]);
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("marcarFacturasComoEnviadas hace update con enviada_cliente_at y los IDs", async () => {
    mock.setTableResult("facturas", { data: null, error: null });
    await marcarFacturasComoEnviadas(["a", "b"]);
    const call = mock.tableCalls[0];
    const updateArgs = call.opArgs[call.ops.indexOf("update")];
    expect(updateArgs?.[0]).toHaveProperty("enviada_cliente_at");
    expect(call.opArgs[call.ops.indexOf("in")]).toEqual(["id", ["a", "b"]]);
  });

  it("marcarFacturasComoEnviadas propaga error", async () => {
    mock.setTableResult("facturas", { data: null, error: new Error("bad") });
    await expect(marcarFacturasComoEnviadas(["a"])).rejects.toThrow("bad");
  });
});
