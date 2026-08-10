/**
 * B5 (Ola 7) — parseo único de montos tecleados / importados.
 *
 * Antes cada módulo limpiaba los separadores a su manera
 * (`replace(/,/g,"")`, `Number(v.replace(...))`, doble limpieza en
 * `useNumericField`), así que "1,200.50" se interpretaba distinto según la
 * pantalla. Este módulo es la ÚNICA forma permitida de quitar separadores de
 * miles, espacios duros y símbolos de moneda antes de convertir a número.
 */

/** Espacios (incl. no-rompibles / finos) y símbolo de moneda. */
const RUIDO_RE = /[\s\u00a0\u202f$]/g;

/**
 * Quita ruido y separadores de miles conservando el punto decimal.
 * `"$ 1,200.50"` → `"1200.50"`; `"1,2"` → `"1,2"` (no es separador de miles).
 */
export function limpiarSeparadoresMiles(raw: string): string {
  return raw.replace(RUIDO_RE, "").replace(/,(?=\d{3}\b)/g, "");
}

/**
 * Convierte un monto tecleado a número finito. Devuelve `fallback` cuando el
 * texto no es interpretable (`""`, `"."`, `"abc"`, `"1.2.3"`).
 */
export function parseMonto(raw: string, fallback = 0): number {
  const limpio = limpiarSeparadoresMiles(raw);
  if (limpio === "") return fallback;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : fallback;
}
