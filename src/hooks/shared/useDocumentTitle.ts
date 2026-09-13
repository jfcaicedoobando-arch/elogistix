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
 *  restaura al desmontar (evita que una ruta "manche" el título de otra).
 *
 *  MR-UI-01: la restauración sólo se aplica si el título vigente sigue siendo
 *  el que este componente puso. Con rutas perezosas (React.lazy) la pantalla
 *  saliente puede desmontarse DESPUÉS de que la entrante ya fijó su título; sin
 *  esta guarda, el "Iniciar sesión" viejo sobrescribía el título real. */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    const previous = document.title;
    const aplicado = buildDocumentTitle(title);
    document.title = aplicado;
    return () => {
      if (document.title === aplicado) {
        document.title = previous;
      }
    };
  }, [title]);
}
