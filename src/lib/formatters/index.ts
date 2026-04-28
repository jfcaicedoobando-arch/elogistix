import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Locale } from "date-fns";

export const formatCurrency = (amount: number, currency: string = 'MXN'): string => {
  const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 });
  const formatted = formatter.format(amount);
  // Intl con MXN devuelve "$57,000.00" (sin código). Forzamos el prefijo "MXN " para
  // mantener consistencia con USD/EUR y evitar ambigüedad entre USD y MXN.
  if (currency === 'MXN' && !formatted.startsWith('MXN')) {
    return `MXN ${formatted.replace(/^\$\s?/, '')}`;
  }
  return formatted;
};

/**
 * Formato de moneda compacto para KPIs/tarjetas estrechas.
 *
 * Usa `Intl.NumberFormat` con `notation: "compact"` para evitar truncamiento
 * tipo "USD 1,234,5…" en columnas angostas. Prefija siempre el código ISO
 * para consistencia con `formatCurrency` (MXN/USD/EUR).
 *
 * Ejemplos: 0 → "USD 0", 845 → "USD 845", 12500 → "USD 12.5K",
 * 1_234_567 → "USD 1.2M".
 *
 * El valor completo (no compacto) debe seguir mostrándose en tooltip
 * mediante el atributo `title` del componente consumidor.
 */
export const formatCurrencyCompact = (amount: number, currency: string = "MXN"): string => {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(safe);
  return `${currency} ${formatted}`;
};
export const formatNumber = (
  value: number | null | undefined,
  options: { decimals?: number; suffix?: string } = {}
): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const { decimals, suffix } = options;
  const formatted = new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? (Number.isInteger(value) ? 0 : 2),
  }).format(value);
  return suffix ? `${formatted} ${suffix}` : formatted;
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
 * Ladas mexicanas de 2 dígitos: solo CDMX, MTY y GDL. Resto son de 3 dígitos.
 */
const LADAS_2_DIGITOS = new Set(["55", "56", "33", "81"]);

/**
 * Formatea un teléfono mexicano de 10 dígitos.
 * - Ladas 2 dígitos (CDMX 55/56, GDL 33, MTY 81) → "(55) 1234-5678"
 * - Ladas 3 dígitos (resto del país) → "(442) 217-0696"
 * Soporta prefijo +52 y devuelve el original si no puede normalizar.
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
    if (LADAS_2_DIGITOS.has(local.slice(0, 2))) {
      return `${country}(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }
    return `${country}(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return raw;
};

/**
 * Diccionario para corregir acentuación de lugares mexicanos comunes
 * que vienen sin acento desde catálogos legacy o entrada manual.
 */
const LUGARES_ACENTUADOS: Record<string, string> = {
  "mexico": "México",
  "ciudad de mexico": "Ciudad de México",
  "queretaro": "Querétaro",
  "yucatan": "Yucatán",
  "michoacan": "Michoacán",
  "nuevo leon": "Nuevo León",
  "san luis potosi": "San Luis Potosí",
  "atizapan": "Atizapán",
  "atizapan de zaragoza": "Atizapán de Zaragoza",
  "san andres cholula": "San Andrés Cholula",
  "merida": "Mérida",
  "leon": "León",
  "torreon": "Torreón",
  "culiacan": "Culiacán",
  "tlaxcala": "Tlaxcala",
  "estado de mexico": "Estado de México",
};

/**
 * Corrige la acentuación de lugares mexicanos comunes y aplica Title Case.
 * Si el texto incluye varias partes separadas por coma, se procesa cada una.
 */
export const correctSpanishPlace = (raw: string | null | undefined): string => {
  if (!raw) return "";
  return raw
    .split(",")
    .map((part) => {
      const titled = toTitleCase(part);
      const key = titled.trim().toLowerCase();
      return LUGARES_ACENTUADOS[key] ?? titled;
    })
    .join(", ");
};
