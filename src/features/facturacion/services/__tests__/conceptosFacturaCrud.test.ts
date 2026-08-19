import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  agregarConceptoFactura,
  actualizarConceptoFactura,
  eliminarConceptoFactura,
  recalcularTotalesFactura,
  fetchConceptosFactura,
} from "../conceptosFacturaCrud";

describe("conceptosFacturaCrud", () => {
  beforeEach(() => {
    mock.resetResults();
    mock.tableCalls.length = 0;
  });

  it("fetchConceptosFactura filtra por factura y descarta soft-deletes", async () => {
    const rows = [{ id: "c1", factura_id: "f1", descripcion: "X", cantidad: 1, precio_unitario: 100, total: 100, clave_sat: "81141601", moneda: "MXN", tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 }];
    mock.setTableResult("conceptos_factura", { data: rows, error: null });
    const out = await fetchConceptosFactura("f1");
    expect(out).toEqual(rows.map((r) => ({ ...r, embarque_expediente: null })));
    const call = mock.tableCalls.find((c) => c.table === "conceptos_factura")!;
    expect(call.ops).toContain("select");
    expect(call.opArgs[call.ops.indexOf("eq")]).toEqual(["factura_id", "f1"]);
    expect(call.opArgs[call.ops.indexOf("is")]).toEqual(["deleted_at", null]);
  });

  it("agregarConceptoFactura inserta y delega el recálculo a la RPC (BL-4)", async () => {
    mock.setTableResult("conceptos_factura", { data: [{ cantidad: 2, precio_unitario: 50, tasa_iva_aplicada: 0.16 }], error: null });
    mock.setTableResult("facturas", { data: { subtotal: 100, iva: 16, ret_isr: 0, ret_iva: 0, total: 116 }, error: null });
    await agregarConceptoFactura({
      facturaId: "f1",
      organizationId: "org1",
      moneda: "MXN",
      input: { descripcion: "Servicio", cantidad: 2, precio_unitario: 50, clave_sat: "78101800" },
    });
    const inserts = mock.tableCalls.filter((c) => c.table === "conceptos_factura" && c.ops.includes("insert"));
    expect(inserts.length).toBe(1);
    // BL-4: ya no hay UPDATE de totales desde el cliente; sólo la RPC.
    const updates = mock.tableCalls.filter((c) => c.table === "facturas" && c.ops.includes("update"));
    expect(updates.length).toBe(0);
    const rpc = mock.rpcCalls.find((c) => c.fn === "recalc_factura_totales");
    expect(rpc).toBeDefined();
    expect(rpc!.args).toEqual({ p_factura_id: "f1" });
  });

  it("α.1 — agregarConceptoFactura rechaza cuando falta clave SAT", async () => {
    await expect(
      agregarConceptoFactura({
        facturaId: "f1", organizationId: "org1", moneda: "MXN",
        input: { descripcion: "Sin clave", cantidad: 1, precio_unitario: 10 },
      }),
    ).rejects.toThrow(/clave SAT/i);
  });

  it("recalcularTotalesFactura devuelve los totales persistidos por la BD", async () => {
    mock.setTableResult("facturas", {
      data: { subtotal: 300, iva: 16, ret_isr: 0, ret_iva: 0, total: 316 },
      error: null,
    });
    const totales = await recalcularTotalesFactura("f1");
    expect(totales).toEqual({ subtotal: 300, iva: 16, retIsr: 0, retIva: 0, total: 316 });
    const updates = mock.tableCalls.filter((c) => c.table === "facturas" && c.ops.includes("update"));
    expect(updates.length).toBe(0);
  });

  it("agregarConceptoFactura rechaza descripción vacía", async () => {
    await expect(
      agregarConceptoFactura({
        facturaId: "f1", organizationId: "org1", moneda: "MXN",
        input: { descripcion: "   ", cantidad: 1, precio_unitario: 10 },
      }),
    ).rejects.toThrow(/descripción/i);
  });

  it("actualizarConceptoFactura patcha por id y recalcula", async () => {
    mock.setTableResult("conceptos_factura", { data: [], error: null });
    mock.setTableResult("facturas", { data: null, error: null });
    await actualizarConceptoFactura({
      conceptoId: "c1", facturaId: "f1",
      input: { descripcion: "Nuevo", cantidad: 1, precio_unitario: 10, clave_sat: "78101800" },
    });
    const update = mock.tableCalls.find((c) => c.table === "conceptos_factura" && c.ops.includes("update"))!;
    expect(update.opArgs[update.ops.indexOf("eq")]).toEqual(["id", "c1"]);
    expect(mock.rpcCalls.some((c) => c.fn === "recalc_factura_totales")).toBe(true);
  });

  it("eliminarConceptoFactura invoca soft_delete_record y recalcula", async () => {
    // v13.290.0 — el borrado ahora pasa por el RPC soft_delete_record; no hay
    // más DELETE físico contra `conceptos_factura`.
    mock.setTableResult("conceptos_factura", { data: [], error: null });
    mock.setTableResult("facturas", { data: null, error: null });
    mock.setRpcResult("soft_delete_record", { data: null, error: null });
    await eliminarConceptoFactura({ conceptoId: "c1", facturaId: "f1" });
    const rpc = mock.rpcCalls.find((c) => c.fn === "soft_delete_record");
    expect(rpc).toBeDefined();
    expect(rpc!.args).toEqual({ _table: "conceptos_factura", _id: "c1" });
    expect(mock.rpcCalls.some((c) => c.fn === "recalc_factura_totales")).toBe(true);
  });

  it("recalcularTotalesFactura sin factura => totales en 0", async () => {
    mock.setTableResult("facturas", { data: null, error: null });
    const totales = await recalcularTotalesFactura("f1");
    expect(totales.subtotal).toBe(0);
    expect(totales.total).toBe(0);
  });
});

