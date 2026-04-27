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
 * Convierte un string a Title Case de forma conservadora.
 * Reglas:
 *  - Conectores en minúscula (de, del, la, los, y, e, en, a, el) excepto si son la primera palabra.
 *  - Whitelist explícita de siglas comunes en mayúsculas (RFC, IVA, USD, etc.).
 *  - Si la palabra ORIGINAL contiene puntos internos (S.A., C.V., S.A.P.I.), se preserva en mayúsculas.
 *  - Tokens corporativos sueltos sa, cv, sapi, sc, srl → mayúsculas.
 *  - Capitaliza después de guiones internos: "vistrain-gonzalez" → "Vistrain-Gonzalez".
 *  - Quita dígitos colgantes al final del token (e.g., "Vargas1" → "Vargas").
 */
const TITLECASE_LOWER_WORDS = new Set([
  "de", "del", "la", "las", "los", "y", "e", "en", "a", "el",
]);

const TITLECASE_ACRONYMS = new Set([
  "RFC", "CFDI", "IVA", "ISR", "USD", "EUR", "MXN", "USA", "EU", "UE",
  "LCL", "FCL", "BL", "ETD", "ETA", "CSF", "CDMX", "INE", "API", "CRM",
  "ERP", "SAT", "DOF",
]);

const TITLECASE_CORP_TOKENS = new Set([
  "sa", "cv", "sapi", "sc", "srl", "sab", "sofom",
]);

function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function processToken(original: string, idx: number): string {
  if (!original) return original;
  if (/[A-Za-z]\.([A-Za-z]\.?)+/.test(original)) {
    return original.toUpperCase();
  }
  const cleaned = original.replace(/\d+$/, "");
  const upper = cleaned.toUpperCase();
  const lower = cleaned.toLowerCase();
  if (TITLECASE_ACRONYMS.has(upper)) return upper;
  if (TITLECASE_CORP_TOKENS.has(lower)) return upper;
  if (idx > 0 && TITLECASE_LOWER_WORDS.has(lower)) return lower;
  if (cleaned.includes("-")) {
    return cleaned.split("-").map((p) => capitalizeWord(p)).join("-");
  }
  return capitalizeWord(cleaned);
}

export const toTitleCase = (raw: string | null | undefined): string => {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((token, idx) => processToken(token, idx))
    .join(" ");
};

/**
 * Convierte un email "alan.hernandez@elogistix.com" → "Alan Hernandez".
 * Si no contiene @, opera sobre el string completo separando por . _ -.
 */
export const nombreDesdeEmail = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const local = raw.includes("@") ? raw.split("@")[0] : raw;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
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
