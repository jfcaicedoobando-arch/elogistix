/**
 * Wrapper de la RPC `pnl_financiero_embarque` que devuelve el P&L real
 * (Presupuestado vs. Real) de un embarque, en MXN.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PnlTotalesVenta {
  presupuestada_mxn: number;
  real_mxn: number | null;
  pdte_cobro_mxn: number | null;
}

export interface PnlTotalesCosto {
  presupuestado_mxn: number;
  real_mxn: number | null;
  pdte_pago_mxn: number;
}

export interface PnlPorConcepto {
  concepto: string;
  presupuestado_mxn: number;
  real_mxn: number | null;
  desviacion_mxn: number | null;
}

export interface PnlPorProveedor {
  proveedor_id: string | null;
  proveedor_nombre: string;
  presupuestado_mxn: number;
  real_mxn: number;
  facturas_count: number;
}

/**
 * P2-5 (R5): la RPC emite `presupuestada_mxn` (femenino) en `por_concepto` de
 * ingresos y `presupuestado_mxn` en costos. El front lee un único nombre, por lo
 * que normalizamos aquí; antes el desglose de ingresos mostraba 0 y no cuadraba
 * con el KPI "Venta real · Presup." del encabezado.
 */
function normalizarConceptos(rows: unknown): PnlPorConcepto[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = (r ?? {}) as Record<string, unknown>;
    const presup = numeroFinito(Number(row.presupuestado_mxn ?? row.presupuestada_mxn ?? 0)) ?? 0;
    const real = numeroFinito(row.real_mxn);
    return {
      concepto: String(row.concepto ?? "(sin concepto)"),
      presupuestado_mxn: presup,
      real_mxn: real,
      desviacion_mxn: real === null ? null : numeroFinito(real - presup),
    };
  });
}

export interface PnlCoberturaSeguros {
  evaluada: true;
  vinculados: number;
  completos: number;
  inconsistentes: number;
  sin_atribucion: number;
  asignacion_indeterminada: number;
  sin_valoracion: number;
  insuficientes: number;
}

/** An old/partial payload cannot establish that insurance coverage was checked. */
function normalizarCobertura(raw: unknown): PnlCoberturaSeguros | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const keys = ["vinculados", "completos", "inconsistentes", "sin_atribucion",
    "asignacion_indeterminada", "sin_valoracion", "insuficientes"] as const;
  if (row.evaluada !== true || keys.some((key) =>
    typeof row[key] !== "number" || !Number.isSafeInteger(row[key]) || row[key] < 0)) return null;
  // SAFE-CAST: every aggregate field is checked above before consuming diagnostics.
  const coverage = row as unknown as PnlCoberturaSeguros;
  if (coverage.completos + coverage.inconsistentes !== coverage.vinculados
    || coverage.sin_atribucion + coverage.asignacion_indeterminada
      + coverage.sin_valoracion + coverage.insuficientes !== coverage.inconsistentes) return null;
  return coverage;
}

export interface PnlDocumentacionCostos {
  evaluada: true;
  conceptos: number;
  documentados: number;
  sin_documentar: number;
}

/** Presence must be checked explicitly; a legacy response cannot confirm it. */
function normalizarDocumentacion(raw: unknown): PnlDocumentacionCostos | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const keys = ["conceptos", "documentados", "sin_documentar"] as const;
  if (row.evaluada !== true || keys.some((key) =>
    typeof row[key] !== "number" || !Number.isSafeInteger(row[key]) || row[key] < 0)) return null;
  // SAFE-CAST: every count is checked above before consuming diagnostics.
  const documentation = row as unknown as PnlDocumentacionCostos;
  if (documentation.documentados + documentation.sin_documentar !== documentation.conceptos) return null;
  return documentation;
}

export interface PnlDocumentacionIngresos {
  evaluada: true;
  facturas: number;
  notas_credito_activas: number;
  notas_credito_sin_base: number;
  notas_credito_sin_valoracion: number;
  facturas_sin_valoracion: number;
  repartos_provisionales: number;
  desbordamientos: number;
}

function numeroFinito(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

/** No inferir evaluación desde importes ni convertir documentos desconocidos a cero. */
function normalizarIngresos(raw: unknown): PnlDocumentacionIngresos | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const keys = ["facturas", "notas_credito_activas", "notas_credito_sin_base",
    "notas_credito_sin_valoracion", "facturas_sin_valoracion", "repartos_provisionales", "desbordamientos"] as const;
  if (row.evaluada !== true || keys.some((key) =>
    typeof row[key] !== "number" || !Number.isSafeInteger(row[key]) || row[key] < 0)) return null;
  // SAFE-CAST: all diagnostic fields have been checked before this cross-count validation.
  const doc = row as unknown as PnlDocumentacionIngresos;
  if ((doc.facturas === 0 && doc.notas_credito_activas > 0)
    || doc.facturas_sin_valoracion > doc.facturas
    || doc.notas_credito_sin_base + doc.notas_credito_sin_valoracion > doc.notas_credito_activas
    || doc.repartos_provisionales > Math.min(doc.facturas, doc.notas_credito_activas)) return null;
  return doc;
}

function ingresosVerificados(doc: PnlDocumentacionIngresos | null): boolean {
  return doc !== null && doc.notas_credito_sin_base === 0 && doc.notas_credito_sin_valoracion === 0
    && doc.facturas_sin_valoracion === 0 && doc.repartos_provisionales === 0 && doc.desbordamientos === 0;
}

export interface PnlEmbarque {
  embarque_id: string;
  estado_costos: "completo" | "incompleto";
  estado_ingresos: "completo" | "incompleto";
  ingresos_documentacion: PnlDocumentacionIngresos | null;
  margen_real_pct: number | null;
  utilidad_mxn: number | null;
  notas_credito_sin_base: number;
  costo_sin_asignar_mxn: number;
  facturas_sobreasignadas: number;
  costo_sobreasignado_mxn: number;
  seguros_cobertura: PnlCoberturaSeguros | null;
  costos_documentacion: PnlDocumentacionCostos | null;
  tipo_cambio_usd: number;
  tipo_cambio_eur: number;
  venta: PnlTotalesVenta;
  costo: PnlTotalesCosto;
  por_concepto: PnlPorConcepto[];
  por_concepto_costo: PnlPorConcepto[];
  por_proveedor: PnlPorProveedor[];
}

function normalizarTotales(raw: Partial<PnlEmbarque>) {
  return {
    venta: { presupuestada_mxn: numeroFinito(raw.venta?.presupuestada_mxn) ?? 0,
      real_mxn: numeroFinito(raw.venta?.real_mxn), pdte_cobro_mxn: numeroFinito(raw.venta?.pdte_cobro_mxn) },
    costo: { presupuestado_mxn: numeroFinito(raw.costo?.presupuestado_mxn) ?? 0,
      real_mxn: numeroFinito(raw.costo?.real_mxn), pdte_pago_mxn: numeroFinito(raw.costo?.pdte_pago_mxn) ?? 0 },
  };
}

function costosVerificados(estado: unknown, real: number | null,
  seguros: PnlCoberturaSeguros | null, documentacion: PnlDocumentacionCostos | null): boolean {
  return estado === "completo" && real !== null && seguros !== null && seguros.inconsistentes === 0
    && documentacion !== null && documentacion.sin_documentar === 0;
}

function normalizarEstadoFinanciero(raw: Partial<PnlEmbarque>, totales: Pick<PnlEmbarque, "venta" | "costo">):
Pick<PnlEmbarque, "estado_costos" | "estado_ingresos" | "ingresos_documentacion" | "utilidad_mxn"
  | "margen_real_pct" | "seguros_cobertura" | "costos_documentacion"> {
  const ingresos = normalizarIngresos(raw.ingresos_documentacion);
  const seguros = normalizarCobertura(raw.seguros_cobertura);
  const documentacion = normalizarDocumentacion(raw.costos_documentacion);
  const ventaReal = totales.venta.real_mxn;
  const costoReal = totales.costo.real_mxn;
  const ingresosCompletos = raw.estado_ingresos === "completo" && ingresosVerificados(ingresos) && ventaReal !== null;
  const costosCompletos = costosVerificados(raw.estado_costos, costoReal, seguros, documentacion);
  const utilidad = ingresosCompletos && costosCompletos ? numeroFinito(raw.utilidad_mxn) : null;
  return {
    estado_costos: costosCompletos ? "completo" : "incompleto",
    estado_ingresos: ingresosCompletos ? "completo" : "incompleto",
    ingresos_documentacion: ingresos,
    utilidad_mxn: utilidad,
    margen_real_pct: utilidad !== null && ventaReal !== null && ventaReal > 0 ? numeroFinito(raw.margen_real_pct) : null,
    seguros_cobertura: seguros,
    costos_documentacion: documentacion,
  };
}

export async function fetchPnlEmbarque(embarqueId: string): Promise<PnlEmbarque> {
  const { data, error } = await supabase.rpc("pnl_financiero_embarque", {
    _embarque_id: embarqueId,
  });
  if (error) throw error;
  // SAFE-CAST: RPC `pnl_financiero_embarque` retorna JSON con el shape PnlEmbarque
  // garantizado por la función Postgres (ver migración pnl_financiero_embarque.sql).
  // 13.308.6: defaults defensivos — la RPC puede devolver null en arrays cuando el
  // embarque no tiene conceptos/proveedores. Sentry JAVASCRIPT-REACT-3C.
  const raw = (data ?? {}) as Partial<PnlEmbarque>;
  const totales = normalizarTotales(raw);
  return {
    embarque_id: raw.embarque_id ?? embarqueId,
    ...normalizarEstadoFinanciero(raw, totales),
    notas_credito_sin_base: raw.notas_credito_sin_base ?? 0,
    costo_sin_asignar_mxn: raw.costo_sin_asignar_mxn ?? 0,
    facturas_sobreasignadas: raw.facturas_sobreasignadas ?? 0,
    costo_sobreasignado_mxn: raw.costo_sobreasignado_mxn ?? 0,
    tipo_cambio_usd: raw.tipo_cambio_usd ?? 0,
    tipo_cambio_eur: raw.tipo_cambio_eur ?? 0,
    ...totales,
    por_concepto: normalizarConceptos(raw.por_concepto),
    por_concepto_costo: normalizarConceptos(raw.por_concepto_costo),
    por_proveedor: Array.isArray(raw.por_proveedor) ? raw.por_proveedor : [],
  };
}
