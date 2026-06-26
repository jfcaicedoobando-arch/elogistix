/**
 * Fecha de corte para deprecar el flujo manual de "Marcar proforma como
 * facturada" (DialogMarcarFacturada). A partir de esta fecha, las proformas
 * nuevas DEBEN usar el flujo automático Proforma → Factura → Timbrado FacturApi.
 *
 * Las proformas creadas ANTES del corte siguen mostrando el botón para que
 * el equipo pueda terminar de capturar el histórico manual.
 *
 * v13.137.13 — cierra el pendiente 9 del plan fiscal.
 */
export const MARCAR_FACTURADA_CUTOFF = "2026-01-01T00:00:00Z";

export function puedeMarcarManualmente(createdAt: string | null | undefined): boolean {
  if (!createdAt) return true; // datos sin fecha → asumir histórico
  return createdAt < MARCAR_FACTURADA_CUTOFF;
}
