import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchVinculosReconciliacion } from "../reconciliacionCostos.lecturas";
import { fetchPartidasHuerfanasCount } from "../reconciliacionCostos";
const factura = { id: "f1", folio_proveedor: "F1", estado_aprobacion: "aprobada", deleted_at: null, moneda: "MXN" };
const fiscal = { proveedor_factura_id: "f1", concepto_costo_id: null, conceptos_costo: null };
beforeEach(() => { mock.tableCalls.length = 0; mock.resetResults(); });

describe("62/63: lecturas completas para importes y asociaciones", () => {
  it("lee la segunda página de vínculos para no perder facturación después de 1000 líneas", async () => {
    const fila = { monto: 1, concepto_costo_id: "c1", proveedor_facturas: factura };
    mock.setTableResultOnce("proveedor_facturas_conceptos", { data: Array.from({ length: 1000 }, () => fila), error: null });
    mock.setTableResultOnce("proveedor_facturas_conceptos", { data: [{ ...fila, monto: 25 }], error: null });
    const rows = await fetchVinculosReconciliacion(["c1"], "o1");
    expect(rows.reduce((sum, row) => sum + Number(row.monto), 0)).toBe(1025);
    expect(mock.tableCalls[1].opArgs.filter((_, i) => mock.tableCalls[1].ops[i] === "range")).toContainEqual([1000, 1999]);
  });

  it("una asociación válida después de 1000 partidas fiscales evita falsos huérfanos", async () => {
    mock.setTableResult("proveedor_facturas", { data: [{ id: "f1" }], error: null });
    mock.setTableResultOnce("proveedor_facturas_conceptos", { data: Array.from({ length: 1000 }, () => fiscal), error: null });
    mock.setTableResultOnce("proveedor_facturas_conceptos", { data: [{ ...fiscal, concepto_costo_id: "c1", conceptos_costo: { embarque_id: "e1", deleted_at: null } }], error: null });
    expect(await fetchPartidasHuerfanasCount("e1")).toBe(0);
    const facturaCall = mock.tableCalls[0];
    expect(facturaCall.opArgs.filter((_, i) => facturaCall.ops[i] === "eq")).toContainEqual(["embarque_id", "e1"]);
    expect(facturaCall.opArgs.filter((_, i) => facturaCall.ops[i] === "neq")).toEqual([["estado", "Cancelada"], ["estado_aprobacion", "rechazada"]]);
  });

  it("un fallo en página posterior impide presentar un conteo parcial como cero", async () => {
    mock.setTableResult("proveedor_facturas", { data: [{ id: "f1" }], error: null });
    mock.setTableResultOnce("proveedor_facturas_conceptos", { data: Array.from({ length: 1000 }, () => fiscal), error: null });
    mock.setTableResultOnce("proveedor_facturas_conceptos", { data: null, error: new Error("página no disponible") });
    await expect(fetchPartidasHuerfanasCount("e1")).rejects.toThrow("página no disponible");
  });

  it("sin facturas del embarque no consulta partidas ni mezcla otras facturas", async () => {
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    expect(await fetchPartidasHuerfanasCount("e1")).toBe(0);
    expect(mock.tableCalls).toHaveLength(1);
  });
});
