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
  const raw = getCurrencyFormatter(currency).format(amount);
  // Normaliza NBSP (Intl separa código/símbolo con U+00A0 para algunas monedas
  // como USD/EUR) a espacio normal para output consistente entre monedas.
  const formatted = raw.replace(/\u00a0/g, ' ');
  // Intl con MXN devuelve "$57,000.00" (sin código). Forzamos el prefijo "MXN " para
  // mantener consistencia con USD/EUR y evitar ambigüedad entre USD y MXN.
  const conCodigo = currency === 'MXN' && !formatted.startsWith('MXN')
    ? `MXN ${formatted.replace(/^(-?)\$\s?/, '$1')}`
    : formatted;
  // B-053 (v13.320.40): normaliza el signo negativo para TODAS las monedas
  // (no sólo MXN) para que siempre sea "CODE -monto" y nunca "-CODE monto".
  const match = conCodigo.match(/^(-)?([A-Z]{3})\s*(-)?\s*\$?\s?(.*)$/);
  if (match) {
    const signo = match[1] ?? match[3] ?? '';
    const codigo = match[2];
    const resto = match[4];
    return signo ? `${codigo} -${resto}` : `${codigo} ${resto}`;
  }
  return conCodigo;
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
/** Número compacto sin símbolo de moneda, para ejes de gráficas donde la unidad ya se indica una sola vez. */
export const formatCompactNumber = (amount: number): string => {
  const safe = Number.isFinite(amount) ? amount : 0;
  return getCompactFormatter("compact:1").format(safe);
};

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

/**
 * Formatea un tipo de cambio con 4 decimales (precisión usada por SAT/Banxico).
 * Devuelve "—" para valores no finitos o <= 0.
 */
export const formatTipoCambio = (tc: number | null | undefined): string => {
  if (tc === null || tc === undefined || !Number.isFinite(tc) || tc <= 0) return "—";
  return getNumberFormatter(4, 4).format(tc);
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

/**
 * Porcentaje entero de `parte` sobre `total` (0-∞), redondeado.
 * Devuelve `null` cuando el total no es positivo (no hay base de comparación).
 * `minimo` sirve para barras de progreso que deben verse aunque el valor sea ~0.
 */
export const porcentajeEntero = (
  parte: number | null | undefined,
  total: number | null | undefined,
  options: { minimo?: number } = {},
): number | null => {
  const p = Number(parte);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return null;
  const pct = Math.round((p / t) * 100);
  return options.minimo === undefined ? pct : Math.max(options.minimo, pct);
};

/** Porcentaje entero a partir de una fracción ya calculada (0.35 → 35). */
export const fraccionAPorcentaje = (fraccion: number | null | undefined): number | null =>
  Number.isFinite(Number(fraccion)) ? Math.round(Number(fraccion) * 100) : null;

/** Moneda sin centavos, para tarjetas y resúmenes con poco espacio. */
export const formatCurrencyEntero = (amount: number, currency: string = "MXN"): string =>
  formatCurrency(Math.round(Number.isFinite(amount) ? amount : 0), currency).replace(/\.00$/, "");
