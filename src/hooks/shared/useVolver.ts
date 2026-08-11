import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface VolverState {
  from?: string;
}

/** Función de volver: invocable y con la ruta de respaldo expuesta (`fallback`). */
export type VolverFn = (() => void) & { fallback: string };

/** Ruta actual completa (path + query) tal como la ve el navegador. */
function rutaActual(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search;
}

/**
 * `useVolver` — botón "Volver" consciente del contexto de navegación.
 *
 * Si la navegación vino de dentro de la app (hay historial interno, es decir
 * `location.key !== "default"`) usa `navigate(-1)` para conservar filtros,
 * pestañas o scroll del origen. Si se navegó con un `state.from` explícito
 * (por ejemplo `navigate(ruta, { state: { from: "/embarques?tab=activos" } })`)
 * se respeta esa ruta. Cuando no hay historial interno (llegada directa por
 * URL, refresh, o apertura en pestaña nueva), cae en `fallback`.
 *
 * v13.497.0 — Red de seguridad: si el "atrás" no cambia la ruta (la entrada
 * anterior del historial era la misma página, p. ej. tras un `replace`), se
 * navega al `fallback`. Así un clic siempre produce un cambio visible.
 */
export function useVolver(fallback: string): VolverFn {
  const navigate = useNavigate();
  const location = useLocation();

  const volver = useCallback(() => {
    const state = location.state as VolverState | null | undefined;

    if (state?.from) {
      navigate(state.from);
      return;
    }

    if (location.key !== "default") {
      const antes = rutaActual();
      navigate(-1);
      // Si el historial no nos movió a otra pantalla, usamos la ruta de respaldo.
      setTimeout(() => {
        if (rutaActual() === antes) navigate(fallback, { replace: true });
      }, 120);
      return;
    }

    navigate(fallback);
  }, [navigate, location, fallback]);

  return Object.assign(volver, { fallback }) as VolverFn;
}
