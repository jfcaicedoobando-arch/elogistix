import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchFacturasListado, fetchFacturas, fetchFacturasParaExportar, fetchFacturasClientes } from "../facturasCrud";

const row = (n: number, count = 1201) => ({
  id: `f${n}`, numero: `F-${n}`, cliente_nombre: "ACME", expediente: "EXP", total: 100,
  moneda: n % 2 ? "USD" : "MXN", fecha_emision: "2026-06-01", fecha_vencimiento: "2026-07-01",
  estado: "Emitida", proforma_id: "p1", proforma_numero: "PRO-1",
  factura_pdf_url: null, factura_xml_url: null, total_count: String(count),
});
const filters = { organizationId: "org", clienteNombre: "ACME", estado: "Emitida", search: "F-", fechaDesde: "2026-06-01", fechaHasta: "2026-06-30" };

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
  mock.supabase.rpc.mockClear();
});

describe("facturasCrud", () => {
  it("envía todos los filtros al RPC antes del offset y mapea total_count", async () => {
    mock.setRpcResult("facturas_listado_v2", { data: [row(501)], error: null });
    const result = await fetchFacturasListado({ ...filters, page: 1, pageSize: 500 });
    expect(mock.rpcCalls[0]).toEqual({ fn: "facturas_listado_v2", args: {
      p_org_id: "org", p_cliente_nombre: "ACME", p_estado: "Emitida", p_search: "F-",
      p_fecha_desde: "2026-06-01", p_fecha_hasta: "2026-06-30", p_offset: 500, p_limit: 500,
    } });
    expect(result.count).toBe(1201);
    expect(result.data[0].proformas).toEqual({ numero: "PRO-1" });
  });

  it("normaliza filtros vacíos y todos", async () => {
    mock.setRpcResult("facturas_listado_v2", { data: [], error: null });
    const result = await fetchFacturasListado({ organizationId: null, estado: "todos", clienteNombre: "todos", fechaDesde: "", fechaHasta: "" });
    expect(mock.rpcCalls[0].args).toEqual(expect.objectContaining({ p_org_id: undefined, p_cliente_nombre: undefined, p_estado: undefined, p_search: undefined, p_fecha_desde: undefined, p_fecha_hasta: undefined }));
    expect(result).toEqual({ data: [], count: 0 });
  });

  it("exporta más de 1000 filas recorriendo páginas con los mismos filtros", async () => {
    for (const [start, end] of [[0, 500], [500, 1000], [1000, 1201]]) {
      mock.supabase.rpc.mockResolvedValueOnce({ data: Array.from({ length: end - start }, (_, n) => row(start + n)), error: null });
    }
    const result = await fetchFacturasParaExportar(filters);
    expect(result).toHaveLength(1201);
    expect(new Set(result.map((f) => f.id)).size).toBe(1201);
    expect(result[1200].id).toBe("f1200");
    expect(mock.supabase.rpc.mock.calls.map(([, args]) => (args as { p_offset: number }).p_offset)).toEqual([0, 500, 1000]);
    for (const [, args] of mock.supabase.rpc.mock.calls) expect(args).toEqual(expect.objectContaining({ p_org_id: "org", p_cliente_nombre: "ACME", p_fecha_desde: "2026-06-01", p_fecha_hasta: "2026-06-30", p_search: "F-", p_estado: "Emitida" }));
  });

  it("falla ante respuesta truncada para no exportar una fracción silenciosa", async () => {
    mock.setRpcResult("facturas_listado_v2", { data: [row(1)], error: null });
    await expect(fetchFacturasParaExportar(filters)).rejects.toThrow("todas las facturas");
  });

  it("falla si el total cambia o se repite una página durante la exportación", async () => {
    mock.supabase.rpc.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, n) => row(n)), error: null });
    mock.supabase.rpc.mockResolvedValueOnce({ data: [row(0)], error: null });
    await expect(fetchFacturasParaExportar(filters)).rejects.toThrow("cambiaron");
  });

  it("propaga errores del listado", async () => {
    mock.setRpcResult("facturas_listado_v2", { data: null, error: new Error("rpc") });
    await expect(fetchFacturasListado(filters)).rejects.toThrow("rpc");
  });

  it("el contrato histórico de todas las facturas ya no depende de un límite alto", async () => {
    mock.setRpcResult("facturas_listado_v2", { data: [row(1, 1)], error: null });
    expect(await fetchFacturas("org")).toHaveLength(1);
    expect(mock.rpcCalls[0].args).toEqual(expect.objectContaining({ p_limit: 500, p_offset: 0 }));
  });

  it("el catálogo incluye opciones posteriores a la primera página de clientes", async () => {
    mock.supabase.rpc.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, n) => ({ cliente_nombre: `Cliente ${n}` })), error: null });
    mock.supabase.rpc.mockResolvedValueOnce({ data: [{ cliente_nombre: "Último cliente" }], error: null });
    const clientes = await fetchFacturasClientes("org");
    expect(clientes).toHaveLength(501);
    expect(clientes.at(-1)).toEqual({ id: "Último cliente", nombre: "Último cliente" });
    expect(mock.supabase.rpc).toHaveBeenNthCalledWith(2, "facturas_clientes_listado", { p_org_id: "org", p_offset: 500, p_limit: 500 });
  });
});
