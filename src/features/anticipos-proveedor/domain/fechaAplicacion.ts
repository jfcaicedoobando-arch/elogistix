/** Fechas civiles: la aplicación no puede preceder a ninguno de sus documentos. */
export function fechaMinimaAplicacion(anticipo?: string | null, factura?: string | null) {
  return [anticipo, factura].filter((v): v is string => Boolean(v)).sort().at(-1);
}

export function errorFechaAplicacion(fecha: string, minima: string | undefined, hoy: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "Indica una fecha de aplicación válida.";
  if (minima && fecha < minima) return `La aplicación no puede ser anterior al ${minima} (entrega del anticipo o emisión de la factura).`;
  if (fecha > hoy) return "La aplicación no puede tener una fecha futura.";
  return null;
}

export function fechaMinimaDesdeAnticipo(anticipo: { fecha_anticipo: string } | null, factura?: string | null) {
  return fechaMinimaAplicacion(anticipo?.fecha_anticipo, factura);
}
