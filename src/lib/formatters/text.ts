/** Title case mexicano y derivaciones desde email. */

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
  // R-14: los dígitos finales sólo se descartan cuando el token tiene una raíz
  // alfabética larga ("acme123" → "Acme"). Códigos cortos como "R3", "M2" o
  // "T1" son parte del nombre y deben preservarse íntegros.
  const cleaned = /^[A-Za-z]{3,}\d+$/.test(original) ? original.replace(/\d+$/, "") : original;
  const upper = cleaned.toUpperCase();
  const lower = cleaned.toLowerCase();
  if (TITLECASE_ACRONYMS.has(upper)) return upper;
  if (TITLECASE_CORP_TOKENS.has(lower)) return upper;
  if (idx > 0 && TITLECASE_LOWER_WORDS.has(lower)) return lower;
  // B-050 (v13.320.39): siglas cortas en mayúsculas del original se preservan
  // (QA, TI, IT, HR, etc.) para evitar "Cliente QA" → "Cliente Qa".
  if (/^[A-Z]{2,4}$/.test(cleaned)) return upper;
  if (cleaned.includes("-")) {
    return cleaned.split("-").map((p) => capitalizeWord(p)).join("-");
  }
  return capitalizeWord(cleaned);
}

/**
 * Convierte un string a Title Case de forma conservadora.
 * Reglas:
 *  - Conectores en minúscula (de, del, la, los, y, e, en, a, el) excepto si son la primera palabra.
 *  - Whitelist explícita de siglas comunes en mayúsculas (RFC, IVA, USD, etc.).
 *  - Si la palabra ORIGINAL contiene puntos internos (S.A., C.V.), se preserva en mayúsculas.
 *  - Tokens corporativos sueltos sa, cv, sapi, sc, srl → mayúsculas.
 *  - Capitaliza después de guiones internos.
 *  - Quita dígitos colgantes al final del token.
 */
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

/** Extrae la primera parte de un nombre compuesto (antes de coma o guión largo) */
export const shortName = (raw: string | null): string =>
  raw?.split(/[,—]/)[0].trim() || "-";
