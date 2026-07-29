/**
 * Q-16 — `document.title` consistente por ruta.
 * Uso: `useDocumentTitle("Embarques")` → "Embarques · Libre Carga".
 * Sin argumento (o string vacío) deja sólo el sufijo de la app.
 */
import { useEffect } from "react";

export const APP_TITLE_SUFFIX = "Libre Carga";

export function buildDocumentTitle(title?: string | null): string {
  const trimmed = title?.trim();
  return trimmed ? `${trimmed} · ${APP_TITLE_SUFFIX}` : APP_TITLE_SUFFIX;
}

/** Actualiza `document.title` mientras el componente está montado y lo
 *  restaura al desmontar (evita que una ruta "manche" el título de otra). */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    const previous = document.title;
    document.title = buildDocumentTitle(title);
    return () => {
      document.title = previous;
    };
  }, [title]);
}
