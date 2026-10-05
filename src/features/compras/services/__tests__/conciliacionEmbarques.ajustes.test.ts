import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { listarConciliacionEmbarques } from "../conciliacionEmbarques";
import { calcularResumen, calcularResumenPorEstatus, calcularResumenPorMoneda, fetchReconciliacionEmbarque } from "@/features/embarques/services/reconciliacionCostos";

const factura = { id: "f1", folio_proveedor: "F1", estado: "Registrada", estado_aprobacion: "aprobada", moneda: "MXN", tipo_cambio_usd: null, deleted_at: null };
const costo = (id: string, monto: number, origen: string | null = null) => ({
  id, embarque_id: "e1", concepto: id, proveedor_nombre: "Proveedor", monto, origen,
  moneda: "MXN", estado_liquidacion: "Pendiente",
  embarques: { expediente: "EXP-1", cliente_nombre: "Cliente", estado: "En tránsito" },
});
const setupCaptura = (importe: number, delta: number) => {
  mock.setTableResult("conceptos_costo", { data: [costo("original", 1000), costo("ajuste", delta, "ajuste_factura_proveedor")], error: null });
  mock.setTableResult("proveedor_facturas_conceptos", { data: [
    { concepto_costo_id: "original", monto: importe, proveedor_facturas: factura },
    { concepto_costo_id: "ajuste", monto: delta, proveedor_facturas: factura },
  ], error: null });
};
beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; });

describe("62: contrato real de captura y ajustes firmados de presupuesto", () => {
  it.each([[900, -100], [1040, 40]])("captura presupuesto1000 con asignación%s y ajuste%s sin duplicar facturación", async (importe, delta) => {
    setupCaptura(importe, delta);
    const [principal] = await listarConciliacionEmbarques({ organizationId: "o1" });
    const detalle = await fetchReconciliacionEmbarque("e1");
    const resumen = calcularResumen(detalle);
    const [moneda] = calcularResumenPorMoneda(detalle);
    expect(principal).toMatchObject({ presupuestado: importe, facturado: importe, pendiente: 0, cobertura: 1, estado_conciliacion: "completa", conceptos_total: 1, conceptos_pendientes: 0, pendientes_tc: 0 });
    expect(resumen).toMatchObject({ total_cotizado: importe, total_real: importe, diferencia_total: 0, desviacion_pct_total: 0, conceptos_sin_factura: 0, pendientes_tc: 0 });
    expect(moneda).toMatchObject({ cotizado: importe, real: importe, diferencia: 0, desviacion_pct: 0, sin_factura: 0, pendientes_tc: 0 });
    expect(detalle.find((fila) => fila.concepto_costo_id === "ajuste")).toMatchObject({ cotizado: delta, real_facturado: 0, ajuste_presupuestario: true });
    const estados = calcularResumenPorEstatus(detalle);
    expect(estados.ajuste).toBe(1);
    expect(Object.values(estados).reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(estados.sin_match).toBe(0);
    // El renglón original sigue mostrando su comparación contra la cotización
    // inicial; el ajuste separado explica por qué el total neto sí está cubierto.
    expect(estados[delta < 0 ? "parcial" : "excedente"]).toBe(1);
  });

  it("conserva un importe negativo genuino de factura sobre un costo ordinario", async () => {
    mock.setTableResult("conceptos_costo", { data: [costo("original", 1000)], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [
      { concepto_costo_id: "original", monto: 1000, proveedor_facturas: factura },
      { concepto_costo_id: "original", monto: -100, descripcion: "Ajuste factura textual", proveedor_facturas: { ...factura, id: "f2" } },
    ], error: null });
    const [principal] = await listarConciliacionEmbarques();
    const [detalle] = await fetchReconciliacionEmbarque("e1");
    expect(principal).toMatchObject({ presupuestado: 1000, facturado: 900, pendiente: 100, estado_conciliacion: "parcial", conceptos_pendientes: 1 });
    expect(detalle.real_facturado).toBe(900);
    expect(detalle.facturas.map((vinculo) => vinculo.monto)).toEqual([1000, -100]);
  });
  it.each([[1000, -100, 1100], [0, -10, 10], [0, 10, 0]])("presupuesto%s y asignación%s conservan la resta firmada, factura presente y pendiente%s", async (presupuesto, real, pendiente) => {
    mock.setTableResult("conceptos_costo", { data: [costo("original", presupuesto)], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [{ concepto_costo_id: "original", monto: real, proveedor_facturas: factura }], error: null });
    const [principal] = await listarConciliacionEmbarques();
    expect(principal).toMatchObject({ presupuestado: presupuesto, facturado: real, pendiente, estado_conciliacion: "parcial" });
    expect(calcularResumenPorEstatus(await fetchReconciliacionEmbarque("e1")).sin_match).toBe(0);
  });

  it("un costo ordinario sin factura mantiene el estado parcial aunque otro sobrecosto cubra el total", async () => {
    mock.setTableResult("conceptos_costo", { data: [costo("original", 1000), costo("sin-factura", 100)], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [{ concepto_costo_id: "original", monto: 1100, proveedor_facturas: factura }], error: null });
    expect((await listarConciliacionEmbarques())[0]).toMatchObject({ facturado: 1100, presupuestado: 1100, cobertura: 1, pendiente: 100, estado_conciliacion: "parcial", conceptos_pendientes: 1 });
  });

  it.each([[-100, "conciliado", "completa", 1, 0], [-90, "excedente", "parcial", 0.9, 10], [-110, "parcial", "completa", 1.1, 0], [100, "excedente", "parcial", -1, 200]])(
    "defensa lectora: costo ordinario negativo conserva asignación%s y su estado",
    async (real, estadoFila, estadoGrupo, cobertura, pendiente) => {
      // La escritura vigente prohíbe CC negativos de origen ordinario. El lector
      // conserva el signo si recibe datos legacy; no propone ninguna escritura.
      mock.setTableResult("conceptos_costo", { data: [costo("original", -100, "manual")], error: null });
      mock.setTableResult("proveedor_facturas_conceptos", { data: [{ concepto_costo_id: "original", monto: real, proveedor_facturas: factura }], error: null });
      const [principal] = await listarConciliacionEmbarques();
      const [detalle] = await fetchReconciliacionEmbarque("e1");
      expect(principal).toMatchObject({ presupuestado: -100, facturado: real, estado_conciliacion: estadoGrupo, cobertura, pendiente });
      expect(detalle).toMatchObject({ real_facturado: real, estatus_renglon: estadoFila, ajuste_presupuestario: false });
      expect(detalle.desviacion_pct).toBe(real + 100);
    },
  );

  it.each(["Cancelada", "rechazada", "eliminada"])("un ajuste legacy activo de una factura%s no reduce el presupuesto vigente", async (estado) => {
    setupCaptura(900, -100);
    const inactiva = { ...factura, estado: estado === "Cancelada" ? estado : factura.estado,
      estado_aprobacion: estado === "rechazada" ? estado : factura.estado_aprobacion,
      deleted_at: estado === "eliminada" ? "2026-10-04" : null };
    mock.setTableResult("proveedor_facturas_conceptos", { data: [
      { concepto_costo_id: "original", monto: 900, proveedor_facturas: inactiva },
      { concepto_costo_id: "ajuste", monto: -100, proveedor_facturas: inactiva },
    ], error: null });
    const [principal] = await listarConciliacionEmbarques();
    const detalle = await fetchReconciliacionEmbarque("e1");
    expect(principal).toMatchObject({ presupuestado: 1000, facturado: 0, estado_conciliacion: "sin_facturar" });
    expect(detalle).toHaveLength(1);
    expect(calcularResumen(detalle)).toMatchObject({ total_cotizado: 1000, total_real: 0, diferencia_total: null });
  });

  it.each(["oculto", "ausente", "sin-asignacion-real"])("un ajuste con puente%s falla visible sin falsa conciliación", async (caso) => {
    setupCaptura(900, -100);
    mock.setTableResult("proveedor_facturas_conceptos", { data: caso === "ausente" ? [] : [
      { concepto_costo_id: "ajuste", monto: -100, proveedor_facturas: caso === "oculto" ? null : factura },
    ], error: null });
    await expect(listarConciliacionEmbarques()).rejects.toThrow("sin una factura y una asignación real visibles");
    await expect(fetchReconciliacionEmbarque("e1")).rejects.toThrow("sin una factura y una asignación real visibles");
  });

  it("captura real FX: MXN1000→asignaciónUSD45 TC20 y ajusteUSD−5 se explica por monedas sin falsa cobertura", async () => {
    const usd = { ...factura, moneda: "USD", tipo_cambio_usd: 20 };
    mock.setTableResult("conceptos_costo", { data: [costo("original", 1000), { ...costo("ajuste", -5, "ajuste_factura_proveedor"), moneda: "USD" }], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [
      { concepto_costo_id: "original", monto: 45, proveedor_facturas: usd },
      { concepto_costo_id: "ajuste", monto: -5, proveedor_facturas: usd },
    ], error: null });
    const principal = await listarConciliacionEmbarques();
    const detalle = await fetchReconciliacionEmbarque("e1");
    expect(principal.find((fila) => fila.moneda === "MXN")).toMatchObject({ presupuestado: 1000, facturado: 900, pendiente: 100, estado_conciliacion: "parcial" });
    expect(principal.find((fila) => fila.moneda === "USD")).toMatchObject({ presupuestado: -5, facturado: 0, conceptos_total: 0, estado_conciliacion: "ajuste" });
    const monedas = calcularResumenPorMoneda(detalle);
    expect(monedas.find((fila) => fila.moneda === "MXN")).toMatchObject({ cotizado: 1000, real: 900, diferencia: -100, sin_factura: 0 });
    expect(monedas.find((fila) => fila.moneda === "USD")).toMatchObject({ cotizado: -5, real: 0, diferencia: null, desviacion_pct: null, sin_factura: 0 });
    expect(await listarConciliacionEmbarques({ moneda: "USD" })).toHaveLength(1);
    expect((await listarConciliacionEmbarques({ moneda: "USD" }))[0].estado_conciliacion).toBe("ajuste");
    expect((await listarConciliacionEmbarques({ moneda: "MXN" }))[0].facturado).toBe(900);
  });
  it("un ajusteUSD de facturaA no se atribuye a una baseUSD comparable de facturaB", async () => {
    const usdA = { ...factura, moneda: "USD", tipo_cambio_usd: 20 };
    const usdB = { ...usdA, id: "f2" };
    mock.setTableResult("conceptos_costo", { data: [costo("original", 1000), { ...costo("ajuste", -5, "ajuste_factura_proveedor"), moneda: "USD" }, { ...costo("otro", 100), moneda: "USD" }], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [
      { concepto_costo_id: "original", monto: 45, proveedor_facturas: usdA },
      { concepto_costo_id: "ajuste", monto: -5, proveedor_facturas: usdA },
      { concepto_costo_id: "otro", monto: 100, proveedor_facturas: usdB },
    ], error: null });
    const monedas = calcularResumenPorMoneda(await fetchReconciliacionEmbarque("e1"));
    expect(monedas.find((fila) => fila.moneda === "USD")).toMatchObject({ cotizado: 95, real: 100, diferencia: 0, desviacion_pct: 0 });
  });

  it.each([[-5, 45], [2, 52]])("un ajuste FX%s de facturaA no reduce ni agrega faltantes de facturaB", async (delta, realA) => {
    const usdA = { ...factura, moneda: "USD", tipo_cambio_usd: 20 };
    const usdB = { ...usdA, id: "f2" };
    mock.setTableResult("conceptos_costo", { data: [costo("original", 1000), { ...costo("ajuste", delta, "ajuste_factura_proveedor"), moneda: "USD" }, { ...costo("otro", 100), moneda: "USD" }], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [
      { concepto_costo_id: "original", monto: realA, proveedor_facturas: usdA },
      { concepto_costo_id: "ajuste", monto: delta, proveedor_facturas: usdA },
      { concepto_costo_id: "otro", monto: 90, proveedor_facturas: usdB },
    ], error: null });
    expect((await listarConciliacionEmbarques({ moneda: "USD" }))[0]).toMatchObject({ presupuestado: 100 + delta, facturado: 90,
      pendiente: 10, conceptos_pendientes: 1, estado_conciliacion: "parcial" });
  });

  it("un ajuste FX positivo sin base en esa moneda conserva presentación sólo de ajuste", async () => {
    const usd = { ...factura, moneda: "USD", tipo_cambio_usd: 20 };
    mock.setTableResult("conceptos_costo", { data: [costo("original", 1000), { ...costo("ajuste", 2, "ajuste_factura_proveedor"), moneda: "USD" }], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [
      { concepto_costo_id: "original", monto: 52, proveedor_facturas: usd },
      { concepto_costo_id: "ajuste", monto: 2, proveedor_facturas: usd },
    ], error: null });
    expect((await listarConciliacionEmbarques({ moneda: "USD" }))[0]).toMatchObject({ presupuestado: 2, facturado: 0,
      pendiente: 0, conceptos_pendientes: 0, conceptos_total: 0, estado_conciliacion: "ajuste" });
  });
});
