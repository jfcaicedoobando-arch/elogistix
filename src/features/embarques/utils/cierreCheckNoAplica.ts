/**
 * v13.383.0 — Determina qué checks de la fase "Cobranza y pagos" todavía
 * NO APLICAN, para no pintarlos en verde cuando el saldo es cero simplemente
 * porque aún no existen facturas.
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

export interface CheckMinimo {
  regla: string;
  ok: boolean;
  detalle?: unknown;
}

/**
 * Devuelve el conjunto de reglas que deben mostrarse como "No aplica aún".
 * - CxC: no hay facturas de cliente emitidas.
 * - REP: depende de que exista al menos una factura de cliente con pago.
 * - CxP: no hay facturas de proveedor registradas.
 */
export function calcularReglasNoAplica(checks: readonly CheckMinimo[]): Set<string> {
  const noAplica = new Set<string>();
  const cxc = checks.find((c) => REGLAS_CXC.has(c.regla));
  const cxp = checks.find((c) => REGLAS_CXP.has(c.regla));

  const sinCxc = cxc ? sinFacturas(cxc.detalle) : false;
  const sinCxp = cxp ? sinFacturas(cxp.detalle) : false;

  if (sinCxc) {
    for (const c of checks) {
      if (REGLAS_CXC.has(c.regla) || (REGLAS_REP.has(c.regla) && c.ok)) noAplica.add(c.regla);
    }
  }
  if (sinCxp) {
    for (const c of checks) if (REGLAS_CXP.has(c.regla)) noAplica.add(c.regla);
  }

  return noAplica;
}
