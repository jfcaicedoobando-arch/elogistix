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
    const rows = [{ id: "c1", factura_id: "f1", descripcion: "X", cantidad: 1, precio_unitario: 100, total: 100, clave_sat: "78101800", moneda: "MXN" }];
    mock.setTableResult("conceptos_factura", { data: rows, error: null });
    const out = await fetchConceptosFactura("f1");
    expect(out).toEqual(rows);
    const call = mock.tableCalls.find((c) => c.table === "conceptos_factura")!;
    expect(call.ops).toContain("select");
    expect(call.opArgs[call.ops.indexOf("eq")]).toEqual(["factura_id", "f1"]);
    expect(call.opArgs[call.ops.indexOf("is")]).toEqual(["deleted_at", null]);
  });

  it("agregarConceptoFactura inserta y recalcula totales", async () => {
    mock.setTableResult("conceptos_factura", { data: [{ cantidad: 2, precio_unitario: 50 }], error: null });
    mock.setTableResult("facturas", { data: null, error: null });
    await agregarConceptoFactura({
      facturaId: "f1",
      organizationId: "org1",
      moneda: "MXN",
      input: { descripcion: "Servicio", cantidad: 2, precio_unitario: 50 },
    });
    const inserts = mock.tableCalls.filter((c) => c.table === "conceptos_factura" && c.ops.includes("insert"));
    expect(inserts.length).toBe(1);
    const updates = mock.tableCalls.filter((c) => c.table === "facturas" && c.ops.includes("update"));
    expect(updates.length).toBe(1);
    // subtotal 100, iva 16, total 116 (TASA_IVA=0.16)
    const payload = updates[0].opArgs[updates[0].ops.indexOf("update")][0] as { subtotal: number; iva: number; total: number };
    expect(payload.subtotal).toBe(100);
    expect(payload.iva).toBe(16);
    expect(payload.total).toBe(116);
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
      input: { descripcion: "Nuevo", cantidad: 1, precio_unitario: 10 },
    });
    const update = mock.tableCalls.find((c) => c.table === "conceptos_factura" && c.ops.includes("update"))!;
    expect(update.opArgs[update.ops.indexOf("eq")]).toEqual(["id", "c1"]);
  });

  it("eliminarConceptoFactura borra por id y recalcula", async () => {
    mock.setTableResult("conceptos_factura", { data: [], error: null });
    mock.setTableResult("facturas", { data: null, error: null });
    await eliminarConceptoFactura({ conceptoId: "c1", facturaId: "f1" });
    const del = mock.tableCalls.find((c) => c.table === "conceptos_factura" && c.ops.includes("delete"))!;
    expect(del.opArgs[del.ops.indexOf("eq")]).toEqual(["id", "c1"]);
  });

  it("recalcularTotalesFactura con lista vacía => totales en 0", async () => {
    mock.setTableResult("conceptos_factura", { data: [], error: null });
    mock.setTableResult("facturas", { data: null, error: null });
    await recalcularTotalesFactura("f1");
    const updates = mock.tableCalls.filter((c) => c.table === "facturas" && c.ops.includes("update"));
    const payload = updates[0].opArgs[updates[0].ops.indexOf("update")][0] as { subtotal: number; total: number };
    expect(payload.subtotal).toBe(0);
    expect(payload.total).toBe(0);
  });
});
