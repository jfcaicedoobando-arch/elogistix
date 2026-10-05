import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { listarConciliacionEmbarques } from "../conciliacionEmbarques";
import { calcularResumen, fetchReconciliacionEmbarque } from "@/features/embarques/services/reconciliacionCostos";

const factura = { id: "f1", folio_proveedor: "F1", estado: "Registrada", estado_aprobacion: "aprobada", moneda: "MXN", tipo_cambio_usd: null, deleted_at: null };
const costo = (id: string, monto: number, moneda = "MXN", ajuste = false) => ({
  id, embarque_id: "e1", concepto: id, proveedor_nombre: "Proveedor", monto, moneda,
  origen: ajuste ? "ajuste_factura_proveedor" : "manual", estado_liquidacion: "Pendiente",
  embarques: { expediente: "EXP-QTY", cliente_nombre: "Cliente", estado: "Activo" },
});
beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; });

describe("integración 62/72: neto unitario de partidas ordinarias", () => {
  it.each([[50, 3], [1200, 0.125], [50, "3"], [150, 0], [150, null], [150, undefined]])(
    "monto %s y cantidad %s cubren MXN150 en grupo y detalle", async (monto, cantidad) => {
      mock.setTableResult("conceptos_costo", { data: [costo("c1", 150)], error: null });
      mock.setTableResult("proveedor_facturas_conceptos", { data: [{ monto, cantidad, concepto_costo_id: "c1", proveedor_facturas: factura }], error: null });
      expect((await listarConciliacionEmbarques({ organizationId: "o1" }))[0]).toMatchObject({
        facturado: 150, pendiente: 0, cobertura: 1, conceptos_pendientes: 0, estado_conciliacion: "completa",
      });
      const [detalle] = await fetchReconciliacionEmbarque("e1");
      expect(detalle).toMatchObject({ real_facturado: 150, estatus_renglon: "conciliado" });
      expect(detalle.facturas[0].monto_original).toBe(150);
      const lectura = mock.tableCalls.find((call) => call.table === "proveedor_facturas_conceptos")!;
      expect(lectura.opArgs[lectura.ops.indexOf("select")][0]).toContain("monto, cantidad,");
    },
  );

  it.each([["MXN", 300, "USD", 5], ["USD", 30, "MXN", 200]])(
    "costo %s recibe neto %s desde factura %s y monto unitario %s", async (monedaCosto, presupuesto, monedaFactura, monto) => {
      mock.setTableResult("conceptos_costo", { data: [costo("c1", presupuesto, monedaCosto)], error: null });
      mock.setTableResult("proveedor_facturas_conceptos", { data: [{ monto, cantidad: 3, concepto_costo_id: "c1",
        proveedor_facturas: { ...factura, moneda: monedaFactura, tipo_cambio_usd: 20 } }], error: null });
      expect((await listarConciliacionEmbarques())[0]).toMatchObject({ facturado: presupuesto, pendiente: 0, estado_conciliacion: "completa" });
    },
  );

  it("mantiene el ajuste sintético como delta presupuestario sin multiplicar ni sumar su puente", async () => {
    mock.setTableResult("conceptos_costo", { data: [costo("c1", 150), costo("aj", -30, "MXN", true)], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [
      { monto: 40, cantidad: 3, concepto_costo_id: "c1", proveedor_facturas: factura },
      { monto: -30, cantidad: 9, concepto_costo_id: "aj", proveedor_facturas: factura },
    ], error: null });
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ presupuestado: 120, facturado: 120, pendiente: 0, estado_conciliacion: "completa" });
    const detalle = await fetchReconciliacionEmbarque("e1");
    expect(detalle.find((row) => row.concepto_costo_id === "aj")).toMatchObject({ cotizado: -30, real_facturado: 0, ajuste_presupuestario: true });
    expect(calcularResumen(detalle)).toMatchObject({ total_cotizado: 120, total_real: 120, diferencia_total: 0 });
  });

  it("un excedente ordinario no cancela el faltante de otro aunque ambas partidas tengan cantidades", async () => {
    mock.setTableResult("conceptos_costo", { data: [costo("c1", 1000), costo("c2", 1000)], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [
      { monto: 520, cantidad: 2, concepto_costo_id: "c1", proveedor_facturas: factura },
      { monto: 320, cantidad: 3, concepto_costo_id: "c2", proveedor_facturas: factura },
    ], error: null });
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ facturado: 2000, cobertura: 1, pendiente: 40, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });

  it("conserva la incertidumbre FX y el signo de partidas ordinarias negativas", async () => {
    mock.setTableResult("conceptos_costo", { data: [costo("c1", 100)], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [{ monto: -10, cantidad: 3, concepto_costo_id: "c1", proveedor_facturas: factura }], error: null });
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ facturado: -30, pendiente: 130, estado_conciliacion: "parcial" });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [{ monto: 10, cantidad: 3, concepto_costo_id: "c1", proveedor_facturas: { ...factura, moneda: "USD" } }], error: null });
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ facturado: 0, pendientes_tc: 1, estado_conciliacion: "no_comparable" });
  });

  it("una cantidad inválida no se interpreta silenciosamente como una unidad", async () => {
    mock.setTableResult("conceptos_costo", { data: [costo("c1", 150)], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [{ monto: 150, cantidad: "sin dato", concepto_costo_id: "c1", proveedor_facturas: factura }], error: null });
    await expect(listarConciliacionEmbarques()).rejects.toThrow("cantidad inválida");
  });
});
