/**
 * Normalización de descripciones para matching de conceptos.
 * - Minúsculas.
 * - Sin diacríticos (á→a, ñ→n).
 * - Sin puntuación (queda whitespace).
 * - Sin stopwords genéricas del dominio ("servicio", "de", "del", "la", etc.).
 * - Colapsa espacios múltiples.
 */
const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "y", "o", "a", "en",
  "por", "para", "con", "sin", "un", "una",
  "servicio", "servicios", "cargo", "cargos", "concepto",
  "factura", "cobro", "cuota", "gasto", "gastos",
]);

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizarTexto(input: string | null | undefined): string {
  if (!input) return "";
  const bare = stripDiacritics(String(input))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!bare) return "";
  const tokens = bare.split(" ").filter((t) => t && !STOPWORDS.has(t));
  return tokens.join(" ");
}
