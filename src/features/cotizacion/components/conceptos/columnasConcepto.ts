/**
 * Cuadrículas compartidas de los renglones de conceptos del paso 3.
 *
 * v13.823.286 — antes cada renglón usaba `grid-cols-12` con `col-span-1` para
 * IVA y para las acciones: el select de IVA quedaba en "0…" y la unidad en
 * "conten…". Ahora las columnas se declaran con anchos explícitos, iguales
 * para USD y MXN, y las columnas CALCULADAS (Subtotal, IVA en pesos) sólo
 * aparecen desde `xl`, igual que en el paso 2.
 */

/** USD: Concepto · Unidad · Cant. · Venta unit. · IVA · Venta total · acciones. */
export const CONCEPTO_GRID_USD =
  "grid gap-2 items-end grid-cols-[minmax(0,1fr)_112px_56px_96px_84px_124px_72px]";

/**
 * MXN: mismas columnas que USD + Subtotal e IVA calculados (sólo desde `xl`).
 * El orden de los hijos debe ser: concepto, unidad, cant., venta unit.,
 * tasa IVA, subtotal*, IVA*, venta total, acciones (* con `SOLO_XL`).
 */
export const CONCEPTO_GRID_MXN =
  "grid gap-2 items-end grid-cols-[minmax(0,1fr)_112px_56px_96px_84px_124px_72px] " +
  "xl:grid-cols-[minmax(0,1fr)_112px_56px_96px_84px_112px_104px_124px_72px]";

/** Columna calculada: se lee en el pie de la sección en pantallas medianas. */
export const CONCEPTO_SOLO_XL = "hidden xl:block min-w-0";
