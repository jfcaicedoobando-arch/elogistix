import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { listarConciliacionEmbarques } from "../conciliacionEmbarques";
import { fetchReconciliacionEmbarque } from "@/features/embarques/services/reconciliacionCostos";

const costo = (id = "c1", moneda = "MXN", monto = 1000) => ({
  id, embarque_id: "e1", concepto: "Flete", proveedor_nombre: "Proveedor", monto,
  moneda, estado_liquidacion: "Pendiente",
  embarques: { expediente: "EXP-1", cliente_nombre: "Cliente", estado: "En tránsito" },
});
const vinculo = (monto = 1000, moneda = "MXN", tc: number | null = null) => ({
  concepto_costo_id: "c1", monto, iva: 160,
  proveedor_facturas: {
    id: "f1", folio_proveedor: "F1", moneda, tipo_cambio_usd: tc,
    estado: "Registrada", estado_aprobacion: "aprobada", deleted_at: null,
    total: 1160, categoria_presupuesto_id: "administracion",
  },
});
const setRows = (costos = [costo()], vinculos = [vinculo()]) => {
  mock.setTableResult("conceptos_costo", { data: costos, error: null });
  mock.setTableResult("proveedor_facturas_conceptos", { data: vinculos, error: null });
};
beforeEach(() => { mock.tableCalls.length = 0; setRows(); });

describe("62: facturación de proveedor coincide entre principal y detalle", () => {
  it("una factura aprobada y sin pagos cubre el costo por su base sin IVA", async () => {
    const [principal] = await listarConciliacionEmbarques({ organizationId: "o1" });
    const [detalle] = await fetchReconciliacionEmbarque("e1");
    expect(principal).toMatchObject({ facturado: 1000, pendiente: 0, cobertura: 1, estado_conciliacion: "completa", conceptos_pendientes: 0 });
    expect(principal.facturado).toBe(detalle.real_facturado);
    expect(detalle.facturas[0].estatus_pago).toBe("Registrada");
    expect(mock.tableCalls.some((call) => call.table === "pagos_proveedor")).toBe(false);
  });

  it("un costo Pagado sin vínculo de factura conserva el estado Sin facturar", async () => {
    setRows([{ ...costo(), estado_liquidacion: "Pagado" }], []);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ facturado: 0, pendiente: 1000, estado_conciliacion: "sin_facturar" });
  });

  it.each([["USD", "MXN", 50, 20, 1000], ["MXN", "USD", 1000, 20, 50]])(
    "convierte vínculo %s a costo %s antes de calcular cobertura",
    async (origen, destino, importe, tc, esperado) => {
      setRows([costo("c1", destino, esperado)], [vinculo(importe, origen, tc)]);
      const [principal] = await listarConciliacionEmbarques();
      const [detalle] = await fetchReconciliacionEmbarque("e1");
      expect(principal).toMatchObject({ facturado: esperado, cobertura: 1, estado_conciliacion: "completa" });
      expect(principal.facturado).toBe(detalle.real_facturado);
    },
  );

  it("separa costos MXN y USD y marca faltantes de TC como no comparables", async () => {
    setRows([costo(), costo("c2", "USD", 50)], [vinculo(50, "USD", null)]);
    const rows = await listarConciliacionEmbarques();
    expect(rows.find((row) => row.moneda === "MXN")).toMatchObject({ facturado: 0, pendientes_tc: 1, estado_conciliacion: "no_comparable" });
    expect(rows.find((row) => row.moneda === "USD")).toMatchObject({ presupuestado: 50, estado_conciliacion: "sin_facturar" });
  });

  it.each(["cancelada", "rechazada", "eliminada"])("excluye facturas %s tanto del principal como del detalle", async (caso) => {
    const fila = vinculo();
    if (caso === "cancelada") fila.proveedor_facturas.estado = "Cancelada";
    if (caso === "rechazada") fila.proveedor_facturas.estado_aprobacion = "rechazada";
    if (caso === "eliminada") Object.assign(fila.proveedor_facturas, { deleted_at: "2026-01-01" });
    setRows([costo()], [fila]);
    const [principal] = await listarConciliacionEmbarques();
    const [detalle] = await fetchReconciliacionEmbarque("e1");
    expect(principal.facturado).toBe(0);
    expect(detalle.facturas).toHaveLength(0);
  });

  it("aplica organización a costos y puentes, conserva RLS y sólo consulta los costos visibles", async () => {
    await listarConciliacionEmbarques({ organizationId: "o1", moneda: "MXN" });
    for (const call of mock.tableCalls) {
      const args = call.opArgs.filter((_, i) => call.ops[i] === "eq");
      expect(args).toContainEqual(["organization_id", "o1"]);
      expect(call.ops.some((op) => ["insert", "update", "delete"].includes(op))).toBe(false);
    }
    const puente = mock.tableCalls.find((call) => call.table === "proveedor_facturas_conceptos")!;
    expect(puente.opArgs.filter((_, i) => puente.ops[i] === "in")).toContainEqual(["concepto_costo_id", ["c1"]]);
  });

  it("propaga errores de vínculos sin presentar facturado cero", async () => {
    mock.setTableResult("proveedor_facturas_conceptos", { data: null, error: new Error("no disponible") });
    await expect(listarConciliacionEmbarques()).rejects.toThrow("no disponible");
  });

  it("64: la categoría Administración conserva los vínculos existentes", async () => {
    const [principal] = await listarConciliacionEmbarques();
    const [detalle] = await fetchReconciliacionEmbarque("e1");
    expect(principal.facturado).toBe(1000);
    expect(detalle.real_facturado).toBe(1000);
  });
});
