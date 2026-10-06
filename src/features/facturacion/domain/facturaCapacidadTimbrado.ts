/**
 * Fecha a partir de la cual el sistema tuvo capacidad de timbrar CFDI.
 * Facturas creadas antes de este corte fueron timbradas directamente en
 * el portal del SAT, por lo que no se puede/debe re-timbrar desde la app.
 */
export const FECHA_INICIO_TIMBRADO_SISTEMA = "2026-07-01T00:00:00Z";

/**
 * Helper reutilizable por listas/tablas donde no se necesita el resto de
 * flags: indica si una factura fue emitida dentro de la ventana en que el
 * sistema puede timbrar (post 01/07/2026). Se usa la fecha de emisión
 * porque es la que el usuario ve y el campo disponible en el listado.
 */
export function esCreadaConCapacidadTimbrado(
  fechaEmision: string | null | undefined,
): boolean {
  if (!fechaEmision) return false;
  return fechaEmision >= FECHA_INICIO_TIMBRADO_SISTEMA;
}
