/**
 * Constantes compartidas del módulo Presupuesto.
 * Fase 3 — extraídas para evitar drift entre `vsReal` (cálculo) y
 * `dashboardEjecutivo/alertas` (alerta ejecutiva).
 */

/** Umbral de sobreejercicio: cumplimiento_pct > este valor dispara alerta. */
export const UMBRAL_SOBREEJERCICIO_PCT = 110;
