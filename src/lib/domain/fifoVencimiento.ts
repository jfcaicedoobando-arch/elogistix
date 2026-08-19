/**
 * BL-9b — Orden FIFO único para repartos de pagos/cobros en lote.
 *
 * Antes cada módulo ordenaba sólo por `fecha_vencimiento`, así que dos
 * facturas que vencen el mismo día quedaban en un orden dependiente del
 * backend (no determinista): el mismo depósito repartía distinto entre dos
 * corridas. El desempate es: vencimiento → emisión → id.
 */

/** Forma mínima que necesita el orden FIFO. */
export interface FifoOrdenable {
  factura_id: string;
  fecha_vencimiento: string | null;
  /** Opcional: si está disponible desempata antes que el id. */
  fecha_emision?: string | null;
}

const LEJANO = "9999-12-31";

/** Comparador estable: vencimiento, luego emisión, luego id. */
export function compararFifo(a: FifoOrdenable, b: FifoOrdenable): number {
  const venc = (a.fecha_vencimiento ?? LEJANO).localeCompare(b.fecha_vencimiento ?? LEJANO);
  if (venc !== 0) return venc;
  const emi = (a.fecha_emision ?? LEJANO).localeCompare(b.fecha_emision ?? LEJANO);
  if (emi !== 0) return emi;
  return a.factura_id.localeCompare(b.factura_id);
}

/** Copia ordenada FIFO (no muta el arreglo original). */
export function ordenarFifo<T extends FifoOrdenable>(facturas: T[]): T[] {
  return [...facturas].sort(compararFifo);
}
