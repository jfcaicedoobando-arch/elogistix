/**
 * Anchos de columna compartidos por el encabezado, los renglones y el pie de
 * totales del bloque de costos del wizard (paso 2).
 *
 * Antes cada uno declaraba sus propios anchos y las cifras del pie no caían
 * bajo su campo. Al vivir aquí, header/fila/totales quedan alineados por
 * construcción: si cambia un ancho, cambia en los tres a la vez.
 */
export const COL_COSTO = {
  concepto: "flex-1 min-w-[220px]",
  proveedor: "w-[120px]",
  unidad: "w-[120px]",
  cantidad: "w-[80px]",
  costoUnitario: "w-[110px]",
  ventaUnitaria: "w-[110px]",
  costoTotal: "w-[110px]",
  ventaTotal: "w-[110px]",
  utilidad: "w-[100px]",
  margen: "w-[72px]",
  acciones: "w-[76px]",
} as const;

/** Ancho mínimo de la cuadrícula: evita que las columnas se compriman. */
export const COSTO_GRID_MIN_W = "min-w-[1240px]";
