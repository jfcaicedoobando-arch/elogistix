import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { listarConciliacionEmbarques } from "../conciliacionEmbarques";
import { calcularResumenPorEstatus, fetchReconciliacionEmbarque } from "@/features/embarques/services/reconciliacionCostos";

const costo = (id: string, monto = 1000, ajuste = false) => ({
  id, embarque_id: "e1", concepto: id, proveedor_nombre: "Proveedor", monto,
  origen: ajuste ? "ajuste_factura_proveedor" : "manual", moneda: "MXN", estado_liquidacion: "Pendiente",
  embarques: { expediente: "EXP1", cliente_nombre: "Cliente", estado: "Activo" },
});
const vinculo = (id: string, monto: number, facturaId: string) => ({
  concepto_costo_id: id, monto, proveedor_facturas: { id: facturaId, folio_proveedor: facturaId,
    estado: "Registrada", estado_aprobacion: "aprobada", moneda: "MXN", deleted_at: null },
});
beforeEach(() => mock.resetResults());
function preparar(costos: ReturnType<typeof costo>[], vinculos: ReturnType<typeof vinculo>[]) {
  mock.setTableResult("conceptos_costo", { data: costos, error: null });
  mock.setTableResult("proveedor_facturas_conceptos", { data: vinculos, error: null });
}

describe("62: faltantes independientes y ajustes con relación verificable", () => {
  it.each(["f2", "f1"])("1040/960 sin ajustes conserva faltante aunque la segunda factura sea %s", async (segundaFactura) => {
    preparar([costo("a"), costo("b")], [vinculo("a", 1040, "f1"), vinculo("b", 960, segundaFactura)]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ presupuestado: 2000, facturado: 2000,
      cobertura: 1, pendiente: 40, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
    expect(calcularResumenPorEstatus(await fetchReconciliacionEmbarque("e1"))).toMatchObject({ excedente: 1, parcial: 1 });
  });

  it("un ajuste de otra factura no cubre el faltante ajeno", async () => {
    preparar([costo("a"), costo("b"), costo("delta", -40, true)],
      [vinculo("a", 1040, "f1"), vinculo("b", 960, "f2"), vinculo("delta", -40, "f1")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ facturado: 2000, pendiente: 40,
      conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });

  it("un ajuste relacionado incompleto conserva la parcialidad", async () => {
    preparar([costo("a"), costo("b"), costo("delta", -20, true)],
      [vinculo("a", 1040, "f1"), vinculo("b", 960, "f2"), vinculo("delta", -20, "f2")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ pendiente: 20, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });

  it("un ajuste positivo explica sólo el excedente de su factura", async () => {
    preparar([costo("a"), costo("b"), costo("delta", 40, true)],
      [vinculo("a", 1040, "f1"), vinculo("b", 960, "f2"), vinculo("delta", 40, "f1")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ presupuestado: 2040, facturado: 2000,
      pendiente: 40, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });

  it("un ajuste cero no acredita compensación entre costos de la misma factura", async () => {
    preparar([costo("a"), costo("b"), costo("delta", 0, true)],
      [vinculo("a", 1040, "f1"), vinculo("b", 960, "f1"), vinculo("delta", 0, "f1")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ pendiente: 40, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });

  it("conserva tolerancia1% contra el presupuesto ajustado de una base inequívoca", async () => {
    preparar([costo("a"), costo("delta", -95, true)], [vinculo("a", 900, "f1"), vinculo("delta", -95, "f1")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ presupuestado: 905, facturado: 900,
      pendiente: 5, conceptos_pendientes: 0, estado_conciliacion: "completa" });
  });

  it("una base grande no aplica su tolerancia al faltante de un ajuste con varios costos", async () => {
    preparar([costo("a", 100000), costo("b", 100), costo("delta", 100, true)],
      [vinculo("a", 100000, "f1"), vinculo("b", 100, "f1"), vinculo("delta", 100, "f1")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ pendiente: 100, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });

  it("varios costos con ajuste parcial conservan la atribución incierta del faltante residual", async () => {
    preparar([costo("a"), costo("b"), costo("delta", -35, true)],
      [vinculo("a", 1040, "f1"), vinculo("b", 960, "f1"), vinculo("delta", -35, "f1")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ pendiente: 5, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });

  it("ajustes firmados neto cero de la misma factura explican la cobertura conjunta", async () => {
    preparar([costo("a"), costo("b"), costo("mas", 40, true), costo("menos", -40, true)],
      [vinculo("a", 1040, "f1"), vinculo("b", 960, "f1"), vinculo("mas", 40, "f1"), vinculo("menos", -40, "f1")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ presupuestado: 2000, facturado: 2000,
      pendiente: 0, conceptos_pendientes: 0, estado_conciliacion: "completa" });
  });

  it("no atribuye presupuesto de un costo con varias facturas a una de ellas", async () => {
    preparar([costo("a"), costo("b"), costo("delta", -100, true)],
      [vinculo("a", 1040, "f1"), vinculo("b", 450, "f2"), vinculo("b", 450, "f3"), vinculo("delta", -100, "f2")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ pendiente: 100, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });

  it("un ajuste de factura presente no cubre un concepto sin factura", async () => {
    preparar([costo("a"), costo("sin", 100), costo("delta", -100, true)],
      [vinculo("a", 1100, "f1"), vinculo("delta", -100, "f1")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ pendiente: 100, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });

  it.each([[990, "completa"], [989, "parcial"]])("conserva la tolerancia por concepto para facturado %s", async (real, estado) => {
    preparar([costo("a"), costo("b")], [vinculo("a", 2000 - real, "f1"), vinculo("b", real, "f2")]);
    expect((await listarConciliacionEmbarques())[0].estado_conciliacion).toBe(estado);
  });

  it("conserva la frontera decimal exacta del límite inferior original", async () => {
    preparar([costo("a", 21.43), costo("b")], [vinculo("a", 21.2157, "f1"), vinculo("b", 1000, "f2")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ conceptos_pendientes: 0, estado_conciliacion: "completa" });
    expect(calcularResumenPorEstatus(await fetchReconciliacionEmbarque("e1"))).toMatchObject({ conciliado: 2 });
  });

  it("un faltante menor de un centavo fuera del1% no se borra con una base grande ajena", async () => {
    preparar([costo("a", 0.5), costo("b"), costo("delta", -0.011, true)],
      [vinculo("a", 0.4799, "f1"), vinculo("b", 1000, "f2"), vinculo("delta", -0.011, "f1")]);
    const [principal] = await listarConciliacionEmbarques();
    expect(principal).toMatchObject({ conceptos_pendientes: 1, estado_conciliacion: "parcial" });
    expect(principal.pendiente).toBeCloseTo(0.0091, 12);
  });

  it("un ajuste exacto a una base grande no crea un faltante por representación IEEE", async () => {
    preparar([costo("a", 1000000), costo("b", 100), costo("delta", -0.05, true)],
      [vinculo("a", 999999.95, "f1"), vinculo("b", 100, "f1"), vinculo("delta", -0.05, "f1")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ presupuestado: 1000099.95, facturado: 1000099.95,
      pendiente: 0, conceptos_pendientes: 0, estado_conciliacion: "completa" });
  });

  it.each([[-90, 10], [-110, -10]])("defensa legacy: un ajuste firmado explica una base negativa con real %s", async (real, delta) => {
    preparar([costo("a", -100), costo("delta", delta, true)], [vinculo("a", real, "f1"), vinculo("delta", delta, "f1")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ presupuestado: real, facturado: real,
      pendiente: 0, conceptos_pendientes: 0, estado_conciliacion: "completa" });
  });

  it("defensa legacy: signos mezclados no permiten decidir a qué base corresponde el ajuste", async () => {
    preparar([costo("a"), costo("b", -100), costo("delta", -40, true)],
      [vinculo("a", 960, "f1"), vinculo("b", -100, "f1"), vinculo("delta", -40, "f1")]);
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ pendiente: 40, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });

  it("un ajuste de otro embarque de la misma factura conserva el faltante", async () => {
    preparar([costo("a"), { ...costo("b"), embarque_id: "e2" }, { ...costo("delta", -40, true), embarque_id: "e2" }],
      [vinculo("a", 960, "f1"), vinculo("b", 1040, "f1"), vinculo("delta", -40, "f1")]);
    expect((await listarConciliacionEmbarques()).find((fila) => fila.embarque_id === "e1")).toMatchObject({ pendiente: 40, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });
});
