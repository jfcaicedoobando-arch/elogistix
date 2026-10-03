/**
 * B5 (Ola 7) — parseo único de montos tecleados / importados.
 *
 * Antes cada módulo limpiaba los separadores a su manera
 * (`replace(/,/g,"")`, `Number(v.replace(...))`, doble limpieza en
 * `useNumericField`), así que "1,200.50" se interpretaba distinto según la
 * pantalla. Este módulo centraliza el parseo numérico y conserva la precisión
 * de tasas/cantidades; MoneyInput aplica su límite de dos decimales.
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
 * Compatibilidad para orígenes que declaren explícitamente punto de miles.
 * La captura es-MX usa siempre punto decimal: inferir miles sólo por tener
 * tres decimales multiplicaba por 1,000 importes válidos como "1234.567".
 */
const PUNTO_DE_MILES_RE = /^(\d+)\.(\d{3})$/;

/**
 * Convierte un monto tecleado a número finito. Devuelve `fallback` cuando el
 * texto no es interpretable (`""`, `"."`, `"abc"`, `"1.2.3"`).
 *
 * El punto siempre es decimal. Las comas sólo agrupan miles si forman grupos
 * completos ("15,000"); una coma restante sin punto es decimal ("1234,567").
 *
 * Se conserva toda la precisión; este parser no limita los importes a centavos.
 */
export function parseMonto(
  raw: string,
  fallback = 0,
  opciones?: { /** Sólo `true` cuando el origen declara punto de miles; por defecto el punto es decimal. */ puntoDeMiles?: boolean },
): number {
  let limpio = raw.replace(RUIDO_RE, "");
  if (limpio.includes(".") || /^[+-]?\d{1,3}(,\d{3})+$/.test(limpio)) {
    limpio = limpio.replace(/,/g, "");
  } else if ((limpio.match(/,/g) ?? []).length === 1) {
    limpio = limpio.replace(",", ".");
  }
  // La compatibilidad es opt-in y no se aplica a formatos con coma.
  if (opciones?.puntoDeMiles === true && !raw.includes(",")) {
    const puntoMiles = limpio.match(PUNTO_DE_MILES_RE);
    if (puntoMiles) limpio = `${puntoMiles[1]}${puntoMiles[2]}`;
  }
  if (limpio === "") return fallback;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : fallback;
}
