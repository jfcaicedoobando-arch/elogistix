/**
 * 13.116.0 (Sprint C) — Tests del wrapper `fetchPnlEmbarque`.
 * El cálculo real vive en la RPC `pnl_financiero_embarque` (SQL). Aquí
 * verificamos que el wrapper propaga errores y pasa el embarqueId
 * correctamente — bug pasado: se pasaba `_id` en vez de `_embarque_id`
 * y los tests con mocks laxos no lo detectaron.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { fetchPnlEmbarque } from "../pnlFinanciero";

const ingresosCompletos = { evaluada: true, facturas: 1, notas_credito_activas: 0,
  notas_credito_sin_base: 0, notas_credito_sin_valoracion: 0, facturas_sin_valoracion: 0,
  repartos_provisionales: 0, desbordamientos: 0 };
const costosDocumentados = { evaluada: true, conceptos: 1, documentados: 1, sin_documentar: 0 };
const segurosCompletos = { evaluada: true, vinculados: 0, completos: 0, inconsistentes: 0,
  sin_atribucion: 0, asignacion_indeterminada: 0, sin_valoracion: 0, insuficientes: 0 };

describe("fetchPnlEmbarque", () => {
  beforeEach(() => rpc.mockReset());

  it("invoca la RPC con el nombre y parámetro EXACTOS", async () => {
    rpc.mockResolvedValue({ data: { embarque_id: "e1" }, error: null });
    await fetchPnlEmbarque("e1");
    // Si alguien renombra el parámetro en el SQL, este test grita.
    expect(rpc).toHaveBeenCalledWith("pnl_financiero_embarque", { _embarque_id: "e1" });
  });

  it("audit129 preserves incomplete costs and null profit instead of fabricating 100%", async () => {
    rpc.mockResolvedValue({ data: { estado_costos: "incompleto", utilidad_mxn: null,
      notas_credito_sin_base: 1, venta: { real_mxn: 150 }, costo: { real_mxn: 0 } }, error: null });
    const result = await fetchPnlEmbarque("e1");
    expect(result.estado_costos).toBe("incompleto");
    expect(result.utilidad_mxn).toBeNull();
    expect(result.notas_credito_sin_base).toBe(1);
  });

  it("audit130 conserva la advertencia de reparto provisional sin inventar utilidad", async () => {
    rpc.mockResolvedValue({ data: { estado_costos: "incompleto", utilidad_mxn: null,
      facturas_sobreasignadas: 1, costo_sobreasignado_mxn: 20 }, error: null });
    const result = await fetchPnlEmbarque("e1");
    expect(result.facturas_sobreasignadas).toBe(1);
    expect(result.costo_sobreasignado_mxn).toBe(20);
    expect(result.utilidad_mxn).toBeNull();
  });

  it("propaga el error de la RPC (no lo silencia)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("permission denied") });
    await expect(fetchPnlEmbarque("e1")).rejects.toThrow("permission denied");
  });

  it("retorna el payload tal cual lo envía la RPC", async () => {
    const payload = {
      embarque_id: "e1",
      estado_costos: "completo",
      estado_ingresos: "completo",
      ingresos_documentacion: ingresosCompletos,
      utilidad_mxn: 330,
      margen_real_pct: 34.736842105,
      notas_credito_sin_base: 0,
      costo_sin_asignar_mxn: 0,
      facturas_sobreasignadas: 0,
      costo_sobreasignado_mxn: 0,
      seguros_cobertura: segurosCompletos,
      costos_documentacion: costosDocumentados,
      tipo_cambio_usd: 17.5,
      tipo_cambio_eur: 19.0,
      venta: { presupuestada_mxn: 1000, real_mxn: 950, pdte_cobro_mxn: 50 },
      costo: { presupuestado_mxn: 600, real_mxn: 620, pdte_pago_mxn: 100 },
      por_concepto: [],
      por_concepto_costo: [],
      por_proveedor: [],
    };
    rpc.mockResolvedValue({ data: payload, error: null });
    const res = await fetchPnlEmbarque("e1");
    expect(res).toEqual(payload);
  });

  it("marca payload legado como cobertura no evaluada, nunca éxito implícito", async () => {
    rpc.mockResolvedValue({ data: { estado_costos: "completo", utilidad_mxn: 500 }, error: null });
    expect((await fetchPnlEmbarque("e1")).seguros_cobertura).toBeNull();
  });

  it("conserva diagnóstico completo e inconsistencia agregada", async () => {
    const coverage = { evaluada: true, vinculados: 3, completos: 1, inconsistentes: 2,
      sin_atribucion: 1, asignacion_indeterminada: 0, sin_valoracion: 0, insuficientes: 1 };
    rpc.mockResolvedValue({ data: { seguros_cobertura: coverage, estado_costos: "incompleto", utilidad_mxn: null }, error: null });
    expect((await fetchPnlEmbarque("e1")).seguros_cobertura).toEqual(coverage);
  });

  it.each([
    { evaluada: true },
    { evaluada: false, vinculados: 0, completos: 0, inconsistentes: 0, sin_atribucion: 0, asignacion_indeterminada: 0, sin_valoracion: 0, insuficientes: 0 },
    { evaluada: true, vinculados: 1, completos: 0, inconsistentes: 0, sin_atribucion: 0, asignacion_indeterminada: 0, sin_valoracion: 0, insuficientes: 0 },
    { evaluada: true, vinculados: 1, completos: 0, inconsistentes: 1, sin_atribucion: -1, asignacion_indeterminada: 0, sin_valoracion: 0, insuficientes: 2 },
  ])("no interpreta un diagnóstico parcial/inválido como verificado (%j)", async (coverage) => {
    rpc.mockResolvedValue({ data: { seguros_cobertura: coverage }, error: null });
    expect((await fetchPnlEmbarque("e1")).seguros_cobertura).toBeNull();
  });
});


describe("audit129 diagnóstico documental", () => {
  it("conserva los conteos sin inferir vínculos a partir del costo o el seguro", async () => {
    const documentation = { evaluada: true, conceptos: 2, documentados: 1, sin_documentar: 1 };
    rpc.mockResolvedValue({ data: { costos_documentacion: documentation }, error: null });
    expect((await fetchPnlEmbarque("e1")).costos_documentacion).toEqual(documentation);
  });

  it.each([
    undefined, null, {},
    { evaluada: true },
    { evaluada: false, conceptos: 0, documentados: 0, sin_documentar: 0 },
    { evaluada: true, conceptos: 1, documentados: 0, sin_documentar: 0 },
    { evaluada: true, conceptos: 1, documentados: 2, sin_documentar: -1 },
    { evaluada: true, conceptos: 1, documentados: "1", sin_documentar: 0 },
    { evaluada: true, conceptos: 1, documentados: 0.5, sin_documentar: 0.5 },
    { evaluada: true, conceptos: Infinity, documentados: Infinity, sin_documentar: 0 },
    { evaluada: true, conceptos: Number.MAX_SAFE_INTEGER + 1, documentados: Number.MAX_SAFE_INTEGER + 1, sin_documentar: 0 },
  ])("diagnóstico ausente o inválido queda no evaluado (%j)", async (documentation) => {
    rpc.mockResolvedValue({ data: { costos_documentacion: documentation }, error: null });
    expect((await fetchPnlEmbarque("e1")).costos_documentacion).toBeNull();
  });

  it("conserva póliza sin conceptos operativos como evaluación válida vacía", async () => {
    const documentation = { evaluada: true, conceptos: 0, documentados: 0, sin_documentar: 0 };
    rpc.mockResolvedValue({ data: { costos_documentacion: documentation }, error: null });
    expect((await fetchPnlEmbarque("e1")).costos_documentacion).toEqual(documentation);
  });
});


describe("audit132 documentación de ingresos", () => {
  const completo = { estado_ingresos: "completo", estado_costos: "completo",
    ingresos_documentacion: ingresosCompletos, costos_documentacion: costosDocumentados,
    seguros_cobertura: segurosCompletos, utilidad_mxn: 60, margen_real_pct: 60,
    venta: { real_mxn: 100 }, costo: { real_mxn: 40 } };

  it.each([
    undefined, null, {}, { ...ingresosCompletos, evaluada: false },
    { ...ingresosCompletos, facturas: "1" }, { ...ingresosCompletos, facturas: -1 },
    { ...ingresosCompletos, facturas: 0.5 }, { ...ingresosCompletos, facturas: Infinity },
    { ...ingresosCompletos, facturas: NaN }, { ...ingresosCompletos, facturas: Number.MAX_SAFE_INTEGER + 1 },
    { ...ingresosCompletos, facturas_sin_valoracion: 2 },
    { ...ingresosCompletos, facturas: 0, notas_credito_activas: 1 },
    { ...ingresosCompletos, notas_credito_activas: 1, notas_credito_sin_base: 1, notas_credito_sin_valoracion: 1 },
    { ...ingresosCompletos, repartos_provisionales: 1 },
    { ...ingresosCompletos, facturas: 0, notas_credito_activas: 1, repartos_provisionales: 1 },
  ])("no confirma utilidad con diagnóstico ausente/inválido (%j)", async (doc) => {
    rpc.mockResolvedValue({ data: { ...completo, ingresos_documentacion: doc }, error: null });
    expect(await fetchPnlEmbarque("e1")).toMatchObject({ estado_ingresos: "incompleto",
      ingresos_documentacion: null, utilidad_mxn: null, margen_real_pct: null });
  });

  it.each(["notas_credito_sin_base", "notas_credito_sin_valoracion", "facturas_sin_valoracion",
    "repartos_provisionales", "desbordamientos"])("cada incidencia %s bloquea utilidad aunque el estado diga completo", async (key) => {
    const doc = { ...ingresosCompletos, notas_credito_activas: 1, [key]: 1 };
    rpc.mockResolvedValue({ data: { ...completo, ingresos_documentacion: doc }, error: null });
    expect(await fetchPnlEmbarque("e1")).toMatchObject({ estado_ingresos: "incompleto",
      ingresos_documentacion: doc, venta: { real_mxn: 100 }, utilidad_mxn: null, margen_real_pct: null });
  });

  it.each([null, undefined, Infinity, -Infinity, NaN, "NaN", "Infinity", "100"])("no convierte venta no finita/ausente %s a cero", async (real) => {
    rpc.mockResolvedValue({ data: { ...completo, venta: { real_mxn: real } }, error: null });
    expect(await fetchPnlEmbarque("e1")).toMatchObject({ estado_ingresos: "incompleto",
      venta: { real_mxn: null }, utilidad_mxn: null, margen_real_pct: null });
  });

  it.each([0, -1350])("conserva actividad documental sin margen cuando venta es %s", async (venta) => {
    const doc = { ...ingresosCompletos, notas_credito_activas: 1 };
    rpc.mockResolvedValue({ data: { ...completo, ingresos_documentacion: doc,
      venta: { real_mxn: venta }, utilidad_mxn: venta - 40, margen_real_pct: 107.4 }, error: null });
    expect(await fetchPnlEmbarque("e1")).toMatchObject({ estado_ingresos: "completo",
      ingresos_documentacion: doc, venta: { real_mxn: venta }, utilidad_mxn: venta - 40, margen_real_pct: null });
  });

  it("no limita desbordamientos al número de documentos", async () => {
    const doc = { ...ingresosCompletos, desbordamientos: 3 };
    rpc.mockResolvedValue({ data: { ...completo, ingresos_documentacion: doc }, error: null });
    expect((await fetchPnlEmbarque("e1")).ingresos_documentacion).toEqual(doc);
  });

  it.each([Infinity, NaN])("elimina utilidad y margen no finitos (%s)", async (value) => {
    rpc.mockResolvedValue({ data: { ...completo, utilidad_mxn: value, margen_real_pct: value }, error: null });
    expect(await fetchPnlEmbarque("e1")).toMatchObject({ utilidad_mxn: null, margen_real_pct: null });
  });
});


it.each([null, undefined, Infinity, NaN])("audit132 conserva saldo de cobro desconocido (%s)", async (pendiente) => {
  rpc.mockResolvedValue({ data: { venta: { real_mxn: 100, pdte_cobro_mxn: pendiente } }, error: null });
  expect((await fetchPnlEmbarque("e1")).venta).toMatchObject({ real_mxn: 100, pdte_cobro_mxn: null });
});
