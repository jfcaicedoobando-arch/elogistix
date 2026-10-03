/** Protege Atrás/Adelante de BrowserRouter antes de que cambie la ruta. */
import { useEffect } from "react";

function historyIndex(state: unknown): number | null {
  if (!state || typeof state !== "object" || !("idx" in state)) return null;
  return typeof state.idx === "number" ? state.idx : null;
}

export function useDirtyHistoryGuard(
  enabled: boolean,
  confirmarSalida: (action: () => void) => void,
) {
  useEffect(() => {
    if (!enabled) return;
    const initialIndex = historyIndex(window.history.state);
    if (initialIndex === null) return;
    let restoringDelta: number | null = null;
    let leaving = false;
    const onPopState = (event: PopStateEvent) => {
      if (leaving) return;
      const nextIndex = historyIndex(event.state);
      if (nextIndex === null) return; // La salida de documento usa beforeunload.
      if (restoringDelta !== null && nextIndex === initialIndex) {
        const delta = restoringDelta;
        restoringDelta = null;
        confirmarSalida(() => {
          leaving = true;
          window.history.go(delta);
        });
        return;
      }
      const delta = nextIndex - initialIndex;
      if (!delta) return;
      // Capture corre antes del listener de BrowserRouter: el formulario no
      // se desmonta durante la restauración de la entrada actual.
      event.stopImmediatePropagation();
      if (restoringDelta !== null) return;
      restoringDelta = delta;
      window.history.go(-delta);
    };
    window.addEventListener("popstate", onPopState, true);
    return () => window.removeEventListener("popstate", onPopState, true);
  }, [enabled, confirmarSalida]);
}
