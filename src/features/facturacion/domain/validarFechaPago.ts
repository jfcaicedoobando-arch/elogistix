/**
 * FE-03 / UIA-06: misma regla y mensajes que `validarFechas` de CxP.
 * Extraído de `DialogRegistrarPago.tsx` (regla react-refresh: un archivo de
 * componentes no debe exportar utilidades).
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
