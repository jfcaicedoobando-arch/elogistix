/**
 * Copy canónico para rangos de fechas (filtros y modales).
 *
 * Regla del proyecto: un rango de fechas SIEMPRE se etiqueta "Desde" / "Hasta".
 * Cuando el rango necesita contexto se antepone un prefijo canónico
 * (`rangoLabel("Emisión", "desde")` -> "Emisión desde").
 *
 * El placeholder de los pickers es siempre `DD/MM/AAAA` (valor por omisión de
 * `DatePickerMx`), por lo que NO debe pasarse `placeholder` en los filtros.
 */

export const RANGO_DESDE_LABEL = "Desde";
export const RANGO_HASTA_LABEL = "Hasta";

/** Prefijos canónicos permitidos para rangos con contexto. */
export const RANGO_PREFIJOS = [
  "Emisión",
  "Vencimiento",
  "Vigencia",
  "Cierre",
  "Pago",
  "ETD",
  "ETA",
] as const;

export type RangoPrefijo = (typeof RANGO_PREFIJOS)[number];
export type RangoExtremo = "desde" | "hasta";

/** Devuelve la etiqueta canónica de un extremo del rango, con prefijo opcional. */
export function rangoLabel(prefijo: RangoPrefijo | null, extremo: RangoExtremo): string {
  const base = extremo === "desde" ? RANGO_DESDE_LABEL : RANGO_HASTA_LABEL;
  if (!prefijo) return base;
  return `${prefijo} ${base.toLowerCase()}`;
}
