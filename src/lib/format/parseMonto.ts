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
 * EC-06 (canon `MoneyInput.sanitizeMoneyText`): en es-MX se pegan montos con
 * punto de miles ("50.000" = 50,000). Un único "." seguido de EXACTAMENTE 3
 * dígitos y sin coma en el texto se interpreta como separador de miles; de
 * otro modo sigue siendo punto decimal ("50.00" = 50, "1.2345" = 1.2345).
 * Antes `parseMonto("50.000")` devolvía 50 mientras MoneyInput registraba
 * 50,000 — el mismo texto valía 1000× distinto según el campo
 * (frontend_hunter P2, parsers de dinero divergentes).
 */
const PUNTO_DE_MILES_RE = /^(\d+)\.(\d{3})$/;

/**
 * Convierte un monto tecleado a número finito. Devuelve `fallback` cuando el
 * texto no es interpretable (`""`, `"."`, `"abc"`, `"1.2.3"`).
 *
 * RG5 (Ola 3): en México se teclea coma decimal ("19,55"). Cuando queda una
 * sola coma y ningún punto, se interpreta como separador decimal; "1,250.50" y
 * "15,000" siguen tratándose como miles.
 *
 * EC-06: "50.000" (punto de miles pegado desde Excel/PDF) se alinea al canon
 * de MoneyInput → 50,000.
 */
export function parseMonto(
  raw: string,
  fallback = 0,
  opciones?: { /** `false` para valores que NO son dinero (p. ej. tipo de cambio con 3 decimales). */ puntoDeMiles?: boolean },
): number {
  let limpio = limpiarSeparadoresMiles(raw);
  const comas = (limpio.match(/,/g) ?? []).length;
  if (comas === 1 && !limpio.includes(".")) limpio = limpio.replace(",", ".");
  // EC-06: igual que MoneyInput, la heurística del punto de miles sólo aplica
  // cuando el texto original NO traía coma ("1,234.567" sí es 1234.567).
  if ((opciones?.puntoDeMiles ?? true) && !raw.includes(",")) {
    const puntoMiles = limpio.match(PUNTO_DE_MILES_RE);
    if (puntoMiles) limpio = `${puntoMiles[1]}${puntoMiles[2]}`;
  }
  if (limpio === "") return fallback;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : fallback;
}
