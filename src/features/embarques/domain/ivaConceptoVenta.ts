/**
 * R179-01 — Tratamiento fiscal guardado de una fila de conceptos_venta.
 *
 * Espejo cliente de la regla B-09 del dominio de proformas: `aplica_iva=false`
 * manda (exento), y si hay tasa explícita ella decide. NO se infiere IVA por
 * moneda ni por el nombre del concepto.
 */
export interface FilaIvaLike {
  aplica_iva?: boolean | null;
  tasa_iva_aplicada?: number | string | null;
}

/** true = la fila causa IVA según su propio tratamiento fiscal guardado. */
export function ivaDeFila(c: FilaIvaLike): boolean {
  if (c.aplica_iva === false) return false;
  const tasa = c.tasa_iva_aplicada;
  if (tasa != null && Number.isFinite(Number(tasa))) return Number(tasa) > 0;
  return !!c.aplica_iva;
}
