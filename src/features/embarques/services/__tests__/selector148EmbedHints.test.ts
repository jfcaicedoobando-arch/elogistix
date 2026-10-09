/** Contract regressions for only the existing relations duplicated by selector148's composite FKs. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchCostosConFactura } from "../costosConFactura";
import { fetchVinculosReconciliacion } from "../reconciliacionCostos.lecturas";
import { fetchPartidasHuerfanasCount } from "../reconciliacionCostos";
import { fetchConceptosCostoAbiertosDeProveedor } from "@/features/cxp/services/conceptosCostoVinculables";
import { PROVEEDOR_FACTURAS_SELECT } from "@/features/cxp/services/proveedorFacturas.types";
import { listarConciliacionEmbarques } from "@/features/compras/services/conciliacionEmbarques";

const invoiceHint = "!proveedor_facturas_conceptos_proveedor_factura_id_fkey";
const conceptHint = "!proveedor_facturas_conceptos_concepto_costo_id_fkey";
const shipmentHint = "!conceptos_costo_embarque_id_fkey";
function readCall(table: string, previousSelect: string, hint: string) {
  const calls = mock.tableCalls.filter((call) => call.table === table);
  const call = calls[calls.length - 1];
  expect(call).toBeDefined();
  if (!call) throw new Error(`Expected read from ${table}`);
  const select = call.opArgs[call.ops.indexOf("select")][0];
  expect(typeof select).toBe("string");
  expect(select).toContain(hint);
  // Removing only the FK-name hint recovers the exact prior fields, aliases and join mode.
  expect(String(select).replace(hint, "")).toBe(previousSelect);
  for (const mutation of ["insert", "update", "delete", "upsert"]) expect(call.ops).not.toContain(mutation);
  return call;
}
function argsFor(call: ReturnType<typeof readCall>, operation: string) {
  return call.opArgs.filter((_, index) => call.ops[index] === operation);
}
beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("selector148: explicit original-FK embeds", () => {
  it("keeps invoice-backed cost IDs and the original shipment/deletion filters", async () => {
    mock.setTableResult("conceptos_costo", { data: [{ id: "cc-a" }], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", {
      data: [{ concepto_costo_id: "cc-a", proveedor_facturas: { estado: "Vigente", deleted_at: null } }], error: null,
    });
    expect([...await fetchCostosConFactura("ship-a")]).toEqual(["cc-a"]);
    readCall("proveedor_facturas_conceptos", "concepto_costo_id, proveedor_facturas(estado, deleted_at)", invoiceHint);
    const source = mock.tableCalls[0];
    expect(argsFor(source, "eq")).toContainEqual(["embarque_id", "ship-a"]);
    expect(argsFor(source, "is")).toContainEqual(["deleted_at", null]);
  });

  it("preserves the nested invoice object, organization scope, ID bounds and pagination", async () => {
    const rows = [{ monto: 100, cantidad: 1, concepto_costo_id: "cc-a", descripcion: "Flete", proveedor_facturas: { id: "pf-a", estado: "Vigente", moneda: "MXN", deleted_at: null } }];
    mock.setTableResult("proveedor_facturas_conceptos", { data: rows, error: null });
    expect(await fetchVinculosReconciliacion(["cc-a"], "org-a")).toEqual(rows);
    const call = readCall("proveedor_facturas_conceptos", "monto, cantidad, concepto_costo_id, descripcion, proveedor_facturas(id, folio_interno, folio_proveedor, fecha_emision, fecha_vencimiento, estado, estado_aprobacion, moneda, tipo_cambio_usd, deleted_at)", invoiceHint);
    expect(argsFor(call, "eq")).toContainEqual(["organization_id", "org-a"]);
    expect(argsFor(call, "in")).toContainEqual(["concepto_costo_id", ["cc-a"]]);
    expect(argsFor(call, "range")).toEqual([[0, 999]]);
  });

  it("keeps the nested cost object and prevents an unrelated invoice from entering the orphan query", async () => {
    mock.setTableResult("proveedor_facturas", { data: [{ id: "pf-a" }], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", {
      data: [{ proveedor_factura_id: "pf-a", concepto_costo_id: "cc-a", conceptos_costo: { embarque_id: "ship-a", deleted_at: null, origen: "manual" } }], error: null,
    });
    expect(await fetchPartidasHuerfanasCount("ship-a")).toBe(0);
    const call = readCall("proveedor_facturas_conceptos", "proveedor_factura_id, concepto_costo_id, conceptos_costo(embarque_id, deleted_at, origen)", conceptHint);
    expect(argsFor(call, "in")).toEqual([["proveedor_factura_id", ["pf-a"]]]);
    expect(argsFor(mock.tableCalls[0], "eq")).toContainEqual(["embarque_id", "ship-a"]);
  });

  it("keeps supplier/tenant restrictions and the same public result shape for linkable costs", async () => {
    mock.setTableResult("conceptos_costo", {
      data: [{ id: "cc-a", embarque_id: "ship-a", concepto: "Flete", monto: "100", moneda: "MXN", fecha_vencimiento: null, embarques: { expediente: "EXP-A", estado: "En Tránsito" } }], error: null,
    });
    expect(await fetchConceptosCostoAbiertosDeProveedor("supplier-a", "org-a")).toEqual([
      { id: "cc-a", embarque_id: "ship-a", embarque_expediente: "EXP-A", concepto: "Flete", monto: 100, moneda: "MXN", fecha_vencimiento: null },
    ]);
    const call = readCall("conceptos_costo", "id, embarque_id, concepto, monto, moneda, fecha_vencimiento, embarques(expediente, estado)", shipmentHint);
    expect(argsFor(call, "eq")).toEqual([["proveedor_id", "supplier-a"], ["estado_liquidacion", "Pendiente"], ["organization_id", "org-a"]]);
    expect(argsFor(call, "is")).toEqual([["deleted_at", null]]);
    expect(argsFor(call, "limit")).toEqual([[200]]);
  });

  it("retains inner-join semantics and the existing organization/deletion bounds in reconciliation", async () => {
    mock.setTableResult("conceptos_costo", { data: [], error: null });
    expect(await listarConciliacionEmbarques({ organizationId: "org-a" })).toEqual([]);
    const call = readCall("conceptos_costo", "id, embarque_id, concepto, proveedor_nombre, monto, moneda, origen, estado_liquidacion, embarques!inner(expediente, cliente_nombre, estado)", shipmentHint);
    expect(argsFor(call, "eq")).toContainEqual(["organization_id", "org-a"]);
    expect(argsFor(call, "is")).toEqual([["deleted_at", null]]);
    expect(argsFor(call, "range")).toEqual([[0, 999]]);
  });

  it("changes only the FK hint in the shared invoice list/detail projection", () => {
    const previous = `
  id, proveedor_id, proveedor_nombre, embarque_id, folio_proveedor, folio_interno,
  fecha_emision, fecha_vencimiento, moneda, subtotal, iva, ieps, retenciones, total,
  estado, tipo_cambio_usd, rfc_proveedor, uuid_fiscal, dias_credito, notas,
  estado_aprobacion, motivo_rechazo, categoria_presupuesto_id,
  archivo_xml_url, archivo_pdf_url,
  uuid_verificado, uuid_verificado_fecha, uuid_estatus_sat,
  fecha_programada_pago,
  fecha_cancelacion, motivo_cancelacion, cancelada_por, created_by, updated_at,
  pagos_proveedor(monto, monto_en_moneda_factura, deleted_at),
  proveedor_notas_credito(monto, estado, deleted_at),
  proveedores(origen_proveedor),
  embarques(expediente),
  presupuesto_categorias!categoria_presupuesto_id(nombre)
`;
    expect(PROVEEDOR_FACTURAS_SELECT).toContain("embarques!proveedor_facturas_embarque_id_fkey(expediente)");
    expect(PROVEEDOR_FACTURAS_SELECT.replace("!proveedor_facturas_embarque_id_fkey", "")).toBe(previous);
  });

  it("still propagates a failed scoped invoice read instead of returning partial data", async () => {
    const error = new Error("invoice read unavailable");
    mock.setTableResult("proveedor_facturas_conceptos", { data: null, error });
    await expect(fetchVinculosReconciliacion(["cc-a"], "org-a")).rejects.toThrow(error.message);
    expect(mock.rpcCalls).toHaveLength(0);
  });

  it("still propagates a failed inner-join reconciliation read", async () => {
    const error = new Error("shipment read unavailable");
    mock.setTableResult("conceptos_costo", { data: null, error });
    await expect(listarConciliacionEmbarques({ organizationId: "org-a" })).rejects.toThrow(error.message);
    expect(mock.rpcCalls).toHaveLength(0);
  });
});
