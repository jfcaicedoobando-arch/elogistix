import { etiquetaTasaIva } from "@/lib/financial/etiquetaTasaIva";
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

/**
 * Etiqueta de la tasa efectiva de un conjunto de filas para la UI de proforma.
 * Si ninguna fila causa IVA devuelve "0%" (antes se imprimía la tasa global de
 * la organización junto a un IVA de 0, que es justo la incoherencia R179-01).
 */
export function etiquetaIvaFilas(filas: ReadonlyArray<FilaIvaLike>, tasaGlobal: number): string {
  const conIva = filas.filter(ivaDeFila);
  if (filas.length > 0 && conIva.length === 0) return "0%";
  return etiquetaTasaIva(
    conIva.map((f) => ({ aplica_iva: f.aplica_iva, tasa_iva_aplicada: f.tasa_iva_aplicada == null ? null : Number(f.tasa_iva_aplicada) })),
    tasaGlobal,
  );
}
