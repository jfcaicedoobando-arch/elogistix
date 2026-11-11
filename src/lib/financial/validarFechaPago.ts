/**
 * Regla de fecha para pagos y cobros. En los lotes se omite la fecha de
 * emisión porque el servidor la verifica por cada factura.
 */
export function validarFechaPago(
  fecha: string,
  hoy: string,
  fechaEmision?: string | null,
): string | null {
  if (!fecha) return "Captura la fecha del pago";
  if (fecha > hoy) return "La fecha del pago no puede ser futura";
  if (fechaEmision && fecha < fechaEmision) {
    return "La fecha del pago no puede ser anterior a la fecha de emisión de la factura";
  }
  return null;
}
