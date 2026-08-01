/**
 * v13.383.0 — Determina qué checks del cierre todavía NO son evaluables, para
 * no pintarlos en verde cuando el resultado es "cero" simplemente porque aún
 * no existen los datos base (facturas, costos comprobados).
 *
 * v13.384.0 — Se amplía a rentabilidad: el margen y las comisiones no pueden
 * medirse mientras falten costos con factura de proveedor o venta por facturar.
 *
 * Función pura (sin React ni Supabase) para poder probarse aislada.
 */

const pick = (d: unknown, key: string): unknown =>
  d && typeof d === "object" ? (d as Record<string, unknown>)[key] : undefined;

/** true si el detalle no reporta ninguna factura (arreglo `por_moneda` vacío). */
function sinFacturas(detalle: unknown): boolean {
  const rows = pick(detalle, "por_moneda");
  if (Array.isArray(rows)) return rows.length === 0;
  // Shape legacy (caché histórica): si no hay total, no hay facturas.
  const total = Number(pick(detalle, "total") ?? 0);
  return Number.isFinite(total) && total === 0;
}

const REGLAS_CXC = new Set(["cxc_cobrada", "cxc_sin_pendientes"]);
const REGLAS_CXP = new Set(["cxp_pagada", "cxp_sin_pendientes"]);
const REGLAS_REP = new Set(["rep_timbrados", "rep_pendientes"]);
const REGLAS_MARGEN = new Set(["margen_minimo", "pnl_margen_minimo"]);
const REGLAS_COMISION = new Set(["comisiones_definitivas", "comision_calculada"]);

/** Reglas que deben estar en OK para que la rentabilidad sea confiable. */
const REGLAS_BASE_RENTABILIDAD = [
  "costo_conceptos_con_factura",
  "facturas_entrantes_evidencia",
  "facturas_entrantes_capturadas",
  "venta_conceptos_facturados",
];

export interface CheckMinimo {
  regla: string;
  ok: boolean;
  detalle?: unknown;
}

export const MOTIVO_SIN_FACTURAS =
  "Todavía no hay facturas registradas, así que este punto aún no se puede evaluar.";
export const MOTIVO_SIN_COMISION =
  "Este embarque está marcado como sin comisión (cuenta directa), así que no hay comisión que medir.";
export const MOTIVO_SIN_COSTOS_COMPROBADOS =
  "Faltan costos con factura de proveedor o venta por facturar: el resultado todavía no es confiable.";

/**
 * Devuelve las reglas que deben mostrarse como "No aplica aún" con su motivo.
 * - CxC / REP: aún no hay facturas de cliente emitidas.
 * - CxP: aún no hay facturas de proveedor registradas.
 * - Margen / comisiones: faltan costos comprobados o venta facturada.
 */
export interface OpcionesNoAplica {
  /** v13.386.0 — El embarque está excluido de comisiones (cliente o override). */
  sinComision?: boolean;
}

function marcar(
  noAplica: Map<string, string>,
  checks: readonly CheckMinimo[],
  aplica: (c: CheckMinimo) => boolean,
  motivo: string,
): void {
  for (const c of checks) {
    if (aplica(c)) noAplica.set(c.regla, motivo);
  }
}

/** CxC (y REP en OK) no evaluables cuando no hay facturas de cliente. */
function marcarCxc(noAplica: Map<string, string>, checks: readonly CheckMinimo[]): void {
  const cxc = checks.find((c) => REGLAS_CXC.has(c.regla));
  if (!cxc || !sinFacturas(cxc.detalle)) return;
  marcar(
    noAplica,
    checks,
    (c) => REGLAS_CXC.has(c.regla) || (REGLAS_REP.has(c.regla) && c.ok),
    MOTIVO_SIN_FACTURAS,
  );
}

/** CxP no evaluable cuando no hay facturas de proveedor. */
function marcarCxp(noAplica: Map<string, string>, checks: readonly CheckMinimo[]): void {
  const cxp = checks.find((c) => REGLAS_CXP.has(c.regla));
  if (!cxp || !sinFacturas(cxp.detalle)) return;
  marcar(noAplica, checks, (c) => REGLAS_CXP.has(c.regla), MOTIVO_SIN_FACTURAS);
}

/** Margen y comisiones sólo son confiables con costos comprobados. */
function marcarRentabilidad(noAplica: Map<string, string>, checks: readonly CheckMinimo[]): void {
  const baseIncompleta = checks.some(
    (c) => REGLAS_BASE_RENTABILIDAD.includes(c.regla) && !c.ok,
  );
  if (!baseIncompleta) return;
  marcar(
    noAplica,
    checks,
    (c) => (REGLAS_MARGEN.has(c.regla) || REGLAS_COMISION.has(c.regla)) && c.ok,
    MOTIVO_SIN_COSTOS_COMPROBADOS,
  );
}

export function calcularReglasNoAplica(
  checks: readonly CheckMinimo[],
  opciones: OpcionesNoAplica = {},
): Map<string, string> {
  const noAplica = new Map<string, string>();

  if (opciones.sinComision) {
    marcar(noAplica, checks, (c) => REGLAS_COMISION.has(c.regla), MOTIVO_SIN_COMISION);
  }
  marcarCxc(noAplica, checks);
  marcarCxp(noAplica, checks);
  marcarRentabilidad(noAplica, checks);

  return noAplica;
}
