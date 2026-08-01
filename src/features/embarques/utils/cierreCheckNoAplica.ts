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
export const MOTIVO_SIN_COSTOS_COMPROBADOS =
  "Faltan costos con factura de proveedor o venta por facturar: el resultado todavía no es confiable.";

/**
 * Devuelve las reglas que deben mostrarse como "No aplica aún" con su motivo.
 * - CxC / REP: aún no hay facturas de cliente emitidas.
 * - CxP: aún no hay facturas de proveedor registradas.
 * - Margen / comisiones: faltan costos comprobados o venta facturada.
 */
export function calcularReglasNoAplica(checks: readonly CheckMinimo[]): Map<string, string> {
  const noAplica = new Map<string, string>();
  const cxc = checks.find((c) => REGLAS_CXC.has(c.regla));
  const cxp = checks.find((c) => REGLAS_CXP.has(c.regla));

  if (cxc && sinFacturas(cxc.detalle)) {
    for (const c of checks) {
      if (REGLAS_CXC.has(c.regla) || (REGLAS_REP.has(c.regla) && c.ok)) {
        noAplica.set(c.regla, MOTIVO_SIN_FACTURAS);
      }
    }
  }
  if (cxp && sinFacturas(cxp.detalle)) {
    for (const c of checks) {
      if (REGLAS_CXP.has(c.regla)) noAplica.set(c.regla, MOTIVO_SIN_FACTURAS);
    }
  }

  // Rentabilidad: sólo tiene sentido cuando ya existen los costos comprobados.
  const baseIncompleta = checks.some(
    (c) => REGLAS_BASE_RENTABILIDAD.includes(c.regla) && !c.ok,
  );
  if (baseIncompleta) {
    for (const c of checks) {
      if ((REGLAS_MARGEN.has(c.regla) || REGLAS_COMISION.has(c.regla)) && c.ok) {
        noAplica.set(c.regla, MOTIVO_SIN_COSTOS_COMPROBADOS);
      }
    }
  }

  return noAplica;
}
