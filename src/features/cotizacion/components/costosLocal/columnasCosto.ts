/**
 * Anchos de columna compartidos por el encabezado, los renglones y el pie de
 * totales del bloque de costos del wizard (paso 2).
 *
 * Antes cada uno declaraba sus propios anchos y las cifras del pie no caían
 * bajo su campo. Al vivir aquí, header/fila/totales quedan alineados por
 * construcción: si cambia un ancho, cambia en los tres a la vez.
 *
 * En pantallas menores a `2xl` (incluidas laptops de 1280 y 1440 px) las
 * lateral abierta) las columnas CALCULADAS (Costo total, Venta total,
 * Utilidad, Margen) se ocultan: se leen en el pie de la sección y en el
 * métricas se leen en un resumen compacto por fila, en el pie de la sección y
 * en el resumen del paso 4. A partir de `2xl` reaparecen todas las columnas.
 */

/** Columnas derivadas: sólo visibles en pantallas anchas. */
const SOLO_2XL = "hidden 2xl:block";

export const COL_COSTO = {
  concepto: "flex-1 min-w-[170px]",
  proveedor: "w-[110px] 2xl:w-[100px]",
  unidad: "w-[124px] 2xl:w-[104px]",
  cantidad: "w-[60px] 2xl:w-[56px]",
  costoUnitario: "w-[92px] 2xl:w-[84px]",
  ventaUnitaria: "w-[92px] 2xl:w-[84px]",
  costoTotal: `${SOLO_2XL} w-[88px]`,
  ventaTotal: `${SOLO_2XL} w-[88px]`,
  utilidad: `${SOLO_2XL} w-[88px]`,
  margen: `${SOLO_2XL} w-[56px]`,
  acciones: "w-[68px]",
} as const;

/**
 * Ancho mínimo de la cuadrícula. En pantallas medianas no se fuerza (las
 * columnas calculadas están ocultas y todo cabe); desde `xl` se conserva el
 * mínimo que evita que las 11 columnas se compriman.
 */
export const COSTO_GRID_MIN_W = "min-w-0 2xl:min-w-[1040px]";
