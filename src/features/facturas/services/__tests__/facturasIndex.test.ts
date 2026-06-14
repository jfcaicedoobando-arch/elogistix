import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchFacturasListado,
  fetchFacturas,
  marcarCostoPagado,
  fetchGastosPendientes,
} from "@/features/facturas/services";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

const ROW = {
  id: "f1",
  numero: "F-001",
  cliente_nombre: "ACME",
  expediente: "EXP-1",
  total: 1000,
  moneda: "MXN",
  fecha_emision: "2026-01-01",
  fecha_vencimiento: "2026-02-01",
  estado: "Emitida",
  proforma_id: "p1",
  proforma_numero: "PRF-001",
  factura_pdf_url: null,
  factura_xml_url: null,
  total_count: "1",
};

describe("services/facturas index", () => {
  it("fetchFacturasListado mapea proforma_numero a proformas.numero", async () => {
    mock.setRpcResult("facturas_listado", { data: [ROW], error: null });
    const r = await fetchFacturasListado({ organizationId: "org1" });
    expect(r.count).toBe(1);
    expect(r.data[0].proformas).toEqual({ numero: "PRF-001" });
  });

  it("fetchFacturasListado: proforma_numero null → proformas null", async () => {
    mock.setRpcResult("facturas_listado", { data: [{ ...ROW, proforma_numero: null }], error: null });
    const r = await fetchFacturasListado({ organizationId: "org1" });
    expect(r.data[0].proformas).toBeNull();
  });

  it("fetchFacturasListado devuelve count=0 sin filas", async () => {
    mock.setRpcResult("facturas_listado", { data: [], error: null });
    const r = await fetchFacturasListado({ organizationId: null });
    expect(r).toEqual({ data: [], count: 0 });
  });

  it("fetchFacturasListado usa defaults page=0 pageSize=50", async () => {
    mock.setRpcResult("facturas_listado", { data: [], error: null });
    await fetchFacturasListado({ organizationId: "org1" });
    const call = mock.rpcCalls[0];
    expect(call.fn).toBe("facturas_listado");
    expect((call.args as Record<string, unknown>).p_offset).toBe(0);
    expect((call.args as Record<string, unknown>).p_limit).toBe(50);
  });

  it("fetchFacturasListado calcula offset = page*pageSize", async () => {
    mock.setRpcResult("facturas_listado", { data: [], error: null });
    await fetchFacturasListado({ organizationId: "org1", page: 3, pageSize: 20 });
    expect((mock.rpcCalls[0].args as Record<string, unknown>).p_offset).toBe(60);
  });

  it("fetchFacturasListado ignora estado='todos'", async () => {
    mock.setRpcResult("facturas_listado", { data: [], error: null });
    await fetchFacturasListado({ organizationId: "org1", estado: "todos" });
    expect((mock.rpcCalls[0].args as Record<string, unknown>).p_estado).toBeUndefined();
  });

  it("fetchFacturasListado pasa estado válido", async () => {
    mock.setRpcResult("facturas_listado", { data: [], error: null });
    await fetchFacturasListado({ organizationId: "org1", estado: "Pagada" });
    expect((mock.rpcCalls[0].args as Record<string, unknown>).p_estado).toBe("Pagada");
  });

  it("fetchFacturasListado propaga error", async () => {
    mock.setRpcResult("facturas_listado", { data: null, error: { message: "boom" } });
    await expect(fetchFacturasListado({ organizationId: "org1" })).rejects.toThrow();
  });

  it("fetchFacturas delega en listado con pageSize alto", async () => {
    mock.setRpcResult("facturas_listado", { data: [ROW], error: null });
    const r = await fetchFacturas("org1");
    expect(r).toHaveLength(1);
    expect((mock.rpcCalls[0].args as Record<string, unknown>).p_limit).toBe(5000);
  });

  it("marcarCostoPagado actualiza conceptos_costo a Pagado", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: null });
    await expect(marcarCostoPagado({ id: "c1", referenciaPago: "REF-1" })).resolves.toBeUndefined();
    expect(mock.tableCalls[0].table).toBe("conceptos_costo");
    expect(mock.tableCalls[0].ops).toContain("update");
  });

  it("marcarCostoPagado normaliza referencia vacía a null", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: null });
    await marcarCostoPagado({ id: "c1" });
    const payload = mock.tableCalls[0].opArgs[mock.tableCalls[0].ops.indexOf("update")]?.[0] as Record<string, unknown>;
    expect(payload.referencia_pago).toBeNull();
  });

  it("marcarCostoPagado propaga error", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: { message: "x" } });
    await expect(marcarCostoPagado({ id: "c1" })).rejects.toThrow();
  });

  it("fetchGastosPendientes devuelve listado", async () => {
    mock.setTableResult("conceptos_costo", { data: [{ id: "c1" }], error: null });
    const r = await fetchGastosPendientes();
    expect(r).toHaveLength(1);
  });

  it("fetchGastosPendientes propaga error", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: { message: "x" } });
    await expect(fetchGastosPendientes()).rejects.toThrow();
  });
});
