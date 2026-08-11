/**
 * Deriva la lista de pendientes que bloquean el guardado de una factura de
 * proveedor. Vive fuera del componente para no romper Fast Refresh.
 *
 * v13.422.0 — Antes el botón se deshabilitaba sin explicar qué faltaba.
 * Solo lee valores que el formulario ya conoce; no agrega reglas nuevas.
 * v13.507.0 — En modo buzón se suman dos advertencias que NO bloquean:
 * el importe no cuadra con lo que declaró operaciones y no hay costos vinculados.
 */
import type { FacturaFormValues } from "@/features/cxp/types";
import { cotejarMontoDeclarado } from "@/lib/domain/montoDeclarado";

export interface PendientesCapturaArgs {
  values: FacturaFormValues;
  total: number;
  /** El tope de vinculación excedido bloquea el guardado. */
  topeExcedido?: boolean;
  /** CFDI ya capturado previamente. */
  cfdiDuplicado?: boolean;
  /** Modo buzón: monto que declaró operaciones al subir el documento. */
  avisoMontoDeclarado?: {
    montoDeclarado: number | null | undefined;
    monedaDeclarada: string | null | undefined;
  };
  /** Modo buzón: la factura no quedó vinculada a ningún costo del embarque. */
  sinVinculos?: boolean;
}

export function pendientesDeCaptura({
  values, total, topeExcedido, cfdiDuplicado, avisoMontoDeclarado, sinVinculos,
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
  if (avisoMontoDeclarado) {
    const cotejo = cotejarMontoDeclarado({
      montoDeclarado: avisoMontoDeclarado.montoDeclarado,
      monedaDeclarada: avisoMontoDeclarado.monedaDeclarada,
      montoCapturado: Number(values.subtotal) || 0,
      monedaCapturada: values.moneda,
    });
    if (cotejo.estado === "difiere") faltan.push("El importe no coincide con lo declarado");
  }
  if (sinVinculos) faltan.push("Sin costos del embarque vinculados");
  return faltan;
}
