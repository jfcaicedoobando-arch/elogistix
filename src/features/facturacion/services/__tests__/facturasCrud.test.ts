import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchFacturasListado, fetchFacturas, marcarCostoPagado, fetchGastosPendientes } from "../facturasCrud";

describe("facturasCrud service", () => {
  beforeEach(() => { mock.tableCalls.length = 0; mock.rpcCalls.length = 0; });

  it("fetchFacturasListado mapea filas y total_count", async () => {
    mock.setRpcResult("facturas_listado", {
      data: [
        {
          id: "f1", numero: "F-1", cliente_nombre: "ACME", expediente: "EXP", total: 100,
          moneda: "MXN", fecha_emision: "2026-06-01", fecha_vencimiento: "2026-07-01",
          estado: "Borrador", proforma_id: "p1", proforma_numero: "PRO-1",
          factura_pdf_url: null, factura_xml_url: null, total_count: "42",
        },
      ],
      error: null,
    });
    const res = await fetchFacturasListado({ organizationId: "org" });
    expect(res.count).toBe(42);
    expect(res.data[0].proformas).toEqual({ numero: "PRO-1" });
  });

  it("fetchFacturasListado normaliza filtros (estado=todos → undefined)", async () => {
    mock.setRpcResult("facturas_listado", { data: [], error: null });
    await fetchFacturasListado({
      organizationId: "org", search: "", estado: "todos", fechaDesde: "", fechaHasta: "",
      page: 2, pageSize: 25,
    });
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_estado).toBeUndefined();
    expect(args.p_search).toBeUndefined();
    expect(args.p_offset).toBe(50);
    expect(args.p_limit).toBe(25);
  });

  it("fetchFacturasListado count=0 cuando data vacía", async () => {
    mock.setRpcResult("facturas_listado", { data: [], error: null });
    const res = await fetchFacturasListado({ organizationId: "org" });
    expect(res.count).toBe(0);
    expect(res.data).toEqual([]);
  });

  it("fetchFacturasListado propaga error del RPC", async () => {
    mock.setRpcResult("facturas_listado", { data: null, error: new Error("rpc") });
    await expect(fetchFacturasListado({ organizationId: "org" })).rejects.toThrow("rpc");
  });

  it("fetchFacturas pasa pageSize=5000", async () => {
    mock.setRpcResult("facturas_listado", { data: [], error: null });
    await fetchFacturas("org");
    expect((mock.rpcCalls[0].args as Record<string, number>).p_limit).toBe(5000);
  });

  it("fetchFacturas pasa organization_id=undefined cuando es null", async () => {
    mock.setRpcResult("facturas_listado", { data: [], error: null });
    await fetchFacturas(null);
    expect((mock.rpcCalls[0].args as Record<string, unknown>).p_organization_id).toBeUndefined();
  });

  it("marcarCostoPagado update con estado Pagado + fecha hoy + referencia", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: null });
    await marcarCostoPagado({ id: "c1", referenciaPago: "REF" });
    const call = mock.tableCalls[0];
    const upd = call.opArgs[call.ops.indexOf("update")]?.[0] as Record<string, string | null>;
    expect(upd.estado_liquidacion).toBe("Pagado");
    expect(upd.referencia_pago).toBe("REF");
    expect(upd.fecha_pago).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("marcarCostoPagado deja referencia_pago=null cuando no se pasa", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: null });
    await marcarCostoPagado({ id: "c1" });
    const call = mock.tableCalls[0];
    const upd = call.opArgs[call.ops.indexOf("update")]?.[0] as Record<string, string | null>;
    expect(upd.referencia_pago).toBeNull();
  });

  it("marcarCostoPagado propaga error del update", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: new Error("perm") });
    await expect(marcarCostoPagado({ id: "c1" })).rejects.toThrow("perm");
  });

  it("fetchGastosPendientes devuelve la data", async () => {
    mock.setTableResult("conceptos_costo", { data: [{ id: "1" }], error: null });
    const r = await fetchGastosPendientes();
    expect(r).toEqual([{ id: "1" }]);
  });

  it("fetchGastosPendientes propaga error de Supabase", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: new Error("x") });
    await expect(fetchGastosPendientes()).rejects.toThrow("x");
  });
});
