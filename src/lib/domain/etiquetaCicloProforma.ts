/**
 * B9 (v13.823.151) — La proforma se marca `estado_proforma = 'facturada'` en
 * cuanto se convierte, aunque la factura resultante siga en Borrador / Sin
 * timbrar. Eso contradecía al resumen del embarque y a la tabla de facturas.
 *
 * Este helper es SÓLO de presentación: no cambia estados en base de datos ni el
 * candado anti-doble conversión (`factura_id` sigue siendo la verdad).
 */

export interface FacturaCicloLite {
  estado: string | null | undefined;
  uuid_fiscal?: string | null;
}

/** Una factura cuenta como emitida cuando salió de Borrador. */
export function facturaEmitida(f: FacturaCicloLite): boolean {
  const estado = (f.estado ?? "").trim().toLowerCase();
  if (!estado) return false;
  if (estado === "borrador") return false;
  return true;
}

export function contarFacturasEmitidas(facturas: FacturaCicloLite[]): number {
  return facturas.filter(facturaEmitida).length;
}

/**
 * Etiqueta del ciclo para una proforma ya convertida.
 * - Sin facturas conocidas → se mantiene "Facturada" (no se oculta el estado).
 * - Todas en Borrador → "Convertida a borrador".
 */
export function etiquetaProformaConvertida(facturas: FacturaCicloLite[]): string {
  if (facturas.length === 0) return "Facturada";
  return contarFacturasEmitidas(facturas) > 0 ? "Facturada" : "Convertida a borrador";
}
