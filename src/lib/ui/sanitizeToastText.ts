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
 * Devuelve un texto seguro y legible para mostrar en un toast.
 * - `undefined`/vacío se conserva como `undefined`.
 * - HTML completo → mensaje genérico entendible.
 * - Fragmentos con etiquetas → texto plano.
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

  return limpio.length > MAX_LARGO ? `${limpio.slice(0, MAX_LARGO - 1).trimEnd()}…` : limpio;
}
