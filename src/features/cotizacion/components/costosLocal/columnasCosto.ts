/**
 * Anchos de columna compartidos por el encabezado, los renglones y el pie de
 * totales del bloque de costos del wizard (paso 2).
 *
 * Antes cada uno declaraba sus propios anchos y las cifras del pie no caían
 * bajo su campo. Al vivir aquí, header/fila/totales quedan alineados por
 * construcción: si cambia un ancho, cambia en los tres a la vez.
 *
 * v13.823.286 — en pantallas menores a `xl` (p. ej. 1108 px con la barra
 * lateral abierta) las columnas CALCULADAS (Costo total, Venta total,
 * Utilidad, Margen) se ocultan: se leen en el pie de la sección y en el
 * resumen del paso 4. Así los campos de captura y las acciones caben sin
 * arrastrar la tabla de lado. A partir de `xl` reaparecen todas.
 */

/** Columnas derivadas: sólo visibles en pantallas anchas. */
const SOLO_XL = "hidden xl:block";

export const COL_COSTO = {
  concepto: "flex-1 min-w-[170px]",
  proveedor: "w-[110px] xl:w-[100px]",
  unidad: "w-[124px] xl:w-[104px]",
  cantidad: "w-[60px] xl:w-[56px]",
  costoUnitario: "w-[92px] xl:w-[84px]",
  ventaUnitaria: "w-[92px] xl:w-[84px]",
  costoTotal: `${SOLO_XL} w-[88px]`,
  ventaTotal: `${SOLO_XL} w-[88px]`,
  utilidad: `${SOLO_XL} w-[88px]`,
  margen: `${SOLO_XL} w-[56px]`,
  acciones: "w-[68px]",
} as const;

/**
 * Ancho mínimo de la cuadrícula. En pantallas medianas no se fuerza (las
 * columnas calculadas están ocultas y todo cabe); desde `xl` se conserva el
 * mínimo que evita que las 11 columnas se compriman.
 */
export const COSTO_GRID_MIN_W = "min-w-0 xl:min-w-[1040px]";
