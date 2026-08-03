/**
 * R-07 — Saneamiento del texto que llega a los toasts.
 *
 * Cuando una función edge o un proxy (Cloudflare, gateway) responde con una
 * página HTML en vez de JSON, el cuerpo crudo terminaba impreso en el toast:
 * el usuario veía "<!DOCTYPE html><html>…" en lugar de un mensaje entendible.
 */

/** Longitud máxima de la descripción de un toast antes de recortar. */
const MAX_LARGO = 240;

const MENSAJE_HTML_GENERICO =
  "El servidor respondió con una página de error en lugar de datos. Reintenta en unos segundos.";

/** ¿El texto es en realidad un documento/fragmento HTML y no un mensaje? */
export function pareceHtml(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  if (t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<?xml")) return true;
  return /<\/?(html|head|body|script|style|div|span|p|title)\b[^>]*>/i.test(texto);
}

/** Quita etiquetas y colapsa espacios de un fragmento con marcado. */
function quitarEtiquetas(texto: string): string {
  return texto
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * FIX 6 (P3) — Nombres crudos de constraints de Postgres
 * (`proveedor_facturas_org_prov_folio_uq`, `clientes_rfc_key`, …) no deben
 * aparecer en el toast: sólo pertenecen a "Ver detalles"/consola.
 */
const CONSTRAINT_RE =
  /"?\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+_(?:uq|key|pkey|fkey|idx|check|unique)\b"?/g;

/** Quita identificadores técnicos de constraints del texto visible. */
export function quitarNombresConstraint(texto: string): string {
  return texto.replace(CONSTRAINT_RE, "").replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1").trim();
}

/**
 * FIX 6 (P3) — Normaliza el formato es-MX de hora ("1:05 p. m.") para que no
 * se produzcan dobles puntos al insertarlo en una frase, y unifica el espacio
 * angosto (U+202F/U+00A0) que Intl mete antes de a. m./p. m.
 */
export function normalizarPuntuacion(texto: string): string {
  return texto
    .replace(/[\u202F\u00A0]/g, " ")
    .replace(/\.{2,}/g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Devuelve un texto seguro y legible para mostrar en un toast.
 * - `undefined`/vacío se conserva como `undefined`.
 * - HTML completo → mensaje genérico entendible.
 * - Fragmentos con etiquetas → texto plano.
 * - Nombres de constraints de Postgres → se eliminan.
 * - Puntuación duplicada ("p. m..") → se normaliza.
 * - Cualquier resultado se recorta a `MAX_LARGO`.
 */
export function sanitizeToastText(texto: string | undefined | null): string | undefined {
  if (texto === undefined || texto === null) return undefined;
  const base = String(texto).trim();
  if (!base) return undefined;

  let limpio = base;
  if (pareceHtml(base)) {
    const plano = quitarEtiquetas(base);
    limpio = plano.length >= 12 ? plano : MENSAJE_HTML_GENERICO;
  }

  limpio = normalizarPuntuacion(quitarNombresConstraint(limpio));
  if (!limpio) return MENSAJE_HTML_GENERICO;

  return limpio.length > MAX_LARGO ? `${limpio.slice(0, MAX_LARGO - 1).trimEnd()}…` : limpio;
}
