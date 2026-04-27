import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Locale } from "date-fns";

export const formatCurrency = (amount: number, currency: string = 'MXN'): string => {
  const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 });
  return formatter.format(amount);
};

/** Extrae la primera parte de un nombre compuesto (antes de coma o guión largo) */
export const shortName = (raw: string | null): string =>
  raw?.split(/[,—]/)[0].trim() || "-";

/** Resuelve el origen de un embarque según modo (puerto > aeropuerto > ciudad) */
export const getOrigen = (e: { puerto_origen?: string | null; aeropuerto_origen?: string | null; ciudad_origen?: string | null }): string =>
  e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "—";

/** Resuelve el destino de un embarque según modo (puerto > aeropuerto > ciudad) */
export const getDestino = (e: { puerto_destino?: string | null; aeropuerto_destino?: string | null; ciudad_destino?: string | null }): string =>
  e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "—";

/** Formatea una fecha ISO a formato legible. Acepta formato y locale opcionales. */
export const formatDate = (
  dateStr: string,
  formatStr: string = 'dd/MM/yyyy',
  options?: { locale?: Locale },
): string => {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), formatStr, { locale: options?.locale ?? es });
  } catch {
    return dateStr;
  }
};

/**
 * Convierte un string a Title Case respetando conectores en minúscula
 * y siglas comunes en mayúsculas (S.A., S.A. de C.V., RFC, etc.).
 */
export const toTitleCase = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const lowerWords = new Set(["de", "del", "la", "las", "los", "y", "e", "en", "a", "el"]);
  const acronymRe = /^([A-Z]\.?){2,5}$/;
  const corpRe = /^(s\.?a\.?|c\.?v\.?|s\.?a\.?p\.?i\.?|s\.?c\.?|s\.?r\.?l\.?|sa|cv|sapi|sc|srl)$/i;
  const tokens = raw.trim().split(/\s+/);
  return tokens
    .map((original, idx) => {
      const lower = original.toLowerCase();
      if (acronymRe.test(original)) return original.toUpperCase();
      if (corpRe.test(lower)) return original.toUpperCase();
      if (idx > 0 && lowerWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
};

/**
 * Formatea un teléfono mexicano de 10 dígitos como "(55) 1234-5678".
 * Soporta lada país +52 y devuelve el original si no puede normalizar.
 */
export const formatPhoneMx = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  let country = "";
  let local = digits;
  if (digits.length === 12 && digits.startsWith("52")) {
    country = "+52 ";
    local = digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith("521")) {
    country = "+52 ";
    local = digits.slice(3);
  }
  if (local.length === 10) {
    return `${country}(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return raw;
};
