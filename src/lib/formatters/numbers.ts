/** Formatos numéricos y de moneda. */

// Caché de Intl.NumberFormat por moneda: construir uno por render costaba
// ~600 constructores en CxP y ~4,000 en conciliación. Mantén el Map interno
// (no exportar) para preservar la API pública.
const currencyFormatterCache = new Map<string, Intl.NumberFormat>();
const getCurrencyFormatter = (currency: string): Intl.NumberFormat => {
  let f = currencyFormatterCache.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 });
    currencyFormatterCache.set(currency, f);
  }
  return f;
};

const compactFormatterCache = new Map<string, Intl.NumberFormat>();
const getCompactFormatter = (key: string): Intl.NumberFormat => {
  let f = compactFormatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    });
    compactFormatterCache.set(key, f);
  }
  return f;
};

const numberFormatterCache = new Map<string, Intl.NumberFormat>();
const getNumberFormatter = (min: number, max: number): Intl.NumberFormat => {
  const key = `${min}:${max}`;
  let f = numberFormatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    });
    numberFormatterCache.set(key, f);
  }
  return f;
};

export const formatCurrency = (amount: number, currency: string = 'MXN'): string => {
  const formatted = getCurrencyFormatter(currency).format(amount);
  // Intl con MXN devuelve "$57,000.00" (sin código). Forzamos el prefijo "MXN " para
  // mantener consistencia con USD/EUR y evitar ambigüedad entre USD y MXN.
  // B-053 (v13.320.40): capturar el signo negativo antes del símbolo para que
  // negativos sean "MXN -8,000.00" en vez de "MXN -$8,000.00".
  if (currency === 'MXN' && !formatted.startsWith('MXN')) {
    return `MXN ${formatted.replace(/^(-?)\$\s?/, '$1')}`;
  }
  return formatted;
};

/** Wrapper canónico para montos en USD (DRY: reemplaza `usdFormatter` locales del feature costeo). */
export const formatUSD = (amount: number): string => formatCurrency(amount, "USD");

/**
 * Formatea moneda con fallback defensivo cuando el valor no es un número finito.
 * DRY: reemplaza el `fmtMoney` local de `cierreCheckFormatters.ts`.
 */
export const formatCurrencySafe = (value: unknown, currency: string = "MXN"): string => {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return formatCurrency(num, currency);
};

/**
 * Formato de moneda compacto para KPIs/tarjetas estrechas.
 *
 * Usa `Intl.NumberFormat` con `notation: "compact"` para evitar truncamiento
 * tipo "USD 1,234,5…" en columnas angostas.
 */
export const formatCurrencyCompact = (amount: number, currency: string = "MXN"): string => {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = getCompactFormatter("compact:1").format(safe);
  return `${currency} ${formatted}`;
};

/** Formatea un número entero/decimal con separadores de miles mexicanos. */
export const formatNumber = (
  value: number | null | undefined,
  options: { decimals?: number; suffix?: string } = {}
): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const { decimals, suffix } = options;
  const min = decimals ?? 0;
  const max = decimals ?? (Number.isInteger(value) ? 0 : 2);
  const formatted = getNumberFormatter(min, max).format(value);
  return suffix ? `${formatted} ${suffix}` : formatted;
};

/** Sufijo de pluralización mexicana ("" para 1, "s" para cualquier otro). */
export const pluralS = (n: number): string => (n === 1 ? "" : "s");

/**
 * Formatea el campo "días de crédito" de proformas/facturas.
 * - null/undefined/"" → "—"
 * - 0 → "Contado"
 * - N → "N días"
 */
export const formatDiasCredito = (
  d: number | string | null | undefined,
): string => {
  if (d === null || d === undefined) return "—";
  if (typeof d === "string" && d.trim() === "") return "—";
  const n = Number(d);
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "Contado";
  return `${n} días`;
};
