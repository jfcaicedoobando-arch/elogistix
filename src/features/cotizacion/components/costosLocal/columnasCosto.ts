/**
 * Anchos de columna compartidos por el encabezado, los renglones y el pie de
 * totales del bloque de costos del wizard (paso 2).
 *
 * Antes cada uno declaraba sus propios anchos y las cifras del pie no caían
 * bajo su campo. Al vivir aquí, header/fila/totales quedan alineados por
 * construcción: si cambia un ancho, cambia en los tres a la vez.
 *
 * v13.823.284 — anchos recortados: con los anteriores (1240 px) las columnas
 * Utilidad/Margen y el botón de eliminar caían fuera de la pantalla en un
 * monitor de 1440 px con la barra lateral abierta. La moneda ya no se repite
 * por celda (vive en el título de la sección), así que los importes caben en
 * una sola línea.
 */
export const COL_COSTO = {
  concepto: "flex-1 min-w-[170px]",
  proveedor: "w-[100px]",
  unidad: "w-[96px]",
  cantidad: "w-[56px]",
  costoUnitario: "w-[84px]",
  ventaUnitaria: "w-[84px]",
  costoTotal: "w-[88px]",
  ventaTotal: "w-[88px]",
  utilidad: "w-[88px]",
  margen: "w-[56px]",
  acciones: "w-[68px]",
} as const;

/** Ancho mínimo de la cuadrícula: evita que las columnas se compriman. */
export const COSTO_GRID_MIN_W = "min-w-[1040px]";
