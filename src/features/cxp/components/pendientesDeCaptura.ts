/**
 * Deriva la lista de pendientes que bloquean el guardado de una factura de
 * proveedor. Vive fuera del componente para no romper Fast Refresh.
 *
 * v13.422.0 — Antes el botón se deshabilitaba sin explicar qué faltaba.
 * Solo lee valores que el formulario ya conoce; no agrega reglas nuevas.
 */
import type { FacturaFormValues } from "@/features/cxp/types";

export interface PendientesCapturaArgs {
  values: FacturaFormValues;
  total: number;
  /** El tope de vinculación excedido bloquea el guardado. */
  topeExcedido?: boolean;
  /** CFDI ya capturado previamente. */
  cfdiDuplicado?: boolean;
}

export function pendientesDeCaptura({
  values, total, topeExcedido, cfdiDuplicado,
}: PendientesCapturaArgs): string[] {
  const faltan: string[] = [];
  if (!values.provId) faltan.push("Falta el proveedor");
  if (!values.folio.trim()) faltan.push("Falta el folio del proveedor");
  if (total <= 0) faltan.push("Falta el importe de la factura");
  if (values.moneda !== "MXN" && !(Number(values.tc) > 0)) {
    faltan.push("Falta el tipo de cambio");
  }
  if (topeExcedido) faltan.push("Lo vinculado excede el subtotal");
  if (cfdiDuplicado) faltan.push("Este CFDI ya está capturado");
  return faltan;
}
