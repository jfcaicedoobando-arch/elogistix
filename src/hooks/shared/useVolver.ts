import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface VolverState {
  from?: string;
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
 */
export function useVolver(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const state = location.state as VolverState | null | undefined;

    if (state?.from) {
      navigate(state.from);
      return;
    }

    if (location.key !== "default") {
      navigate(-1);
      return;
    }

    navigate(fallback);
  }, [navigate, location, fallback]);
}
