/**
 * Utilidades de URLs locales (`blob:`) para PDFs.
 *
 * v13.387.0 — Chrome bloquea el visor incrustado ("This page has been blocked
 * by Chrome") cuando el Blob no llega etiquetado como `application/pdf`
 * (el almacenamiento suele responder `application/octet-stream`). Reetiquetar
 * el Blob antes de `createObjectURL` es lo que permite incrustarlo.
 */
export const MIME_PDF = "application/pdf";

/** Devuelve el mismo Blob si ya es PDF, o una copia etiquetada como PDF. */
export function comoBlobPdf(blob: Blob): Blob {
  if (blob.type === MIME_PDF) return blob;
  return new Blob([blob], { type: MIME_PDF });
}

/** URL local lista para incrustar en `<object>` / `<iframe>`. */
export function crearUrlPdf(blob: Blob): string {
  return URL.createObjectURL(comoBlobPdf(blob));
}

/** `true` si la ruta apunta a un PDF por extensión. */
export function esRutaPdf(path: string | null | undefined): boolean {
  return Boolean(path && /\.pdf(\?|$)/i.test(path));
}
