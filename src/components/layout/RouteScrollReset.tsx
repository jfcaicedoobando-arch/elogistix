/**
 * P2 auditoría v13.824.3 — al cambiar de página el scroll se quedaba a media
 * altura (título y KPIs cortados). Este componente vive dentro del router y
 * sube al inicio SÓLO cuando cambia `pathname`:
 *
 * - Cambios de query string (filtros, modales por URL) no mueven el scroll.
 * - Si la URL trae `#hash`, respetamos el salto al ancla del navegador.
 * - No interfiere con el back/forward: la navegación tipo POP también aterriza
 *   arriba, igual que una página nueva del ERP (no guardamos posiciones).
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function RouteScrollReset() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, hash]);

  return null;
}
