import { type RefObject, useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Restaura el scroll al inicio del contenedor de contenido y de la ventana
 * cuando cambia la ruta (`location.pathname`). Cambios de query params o
 * estado dentro de la misma ruta no disparan la restauración, por lo que el
 * usuario conserva su posición al filtrar u ordenar.
 */
export function useScrollRestoreOnPathname(contentRef: RefObject<HTMLElement | null>) {
  const location = useLocation();

  useEffect(() => {
    const el = contentRef.current;
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [contentRef, location.pathname]);
}
