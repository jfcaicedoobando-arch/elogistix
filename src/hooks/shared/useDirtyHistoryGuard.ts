/** Protege Atrás/Adelante de BrowserRouter antes de que cambie la ruta. */
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeDirtyHistoryGuard } from "@/lib/bootstrap/dirtyHistoryGuard";

function historyIndex(state: unknown): number | null {
  if (!state || typeof state !== "object" || !("idx" in state)) return null;
  return typeof state.idx === "number" ? state.idx : null;
}

export function useDirtyHistoryGuard(
  enabled: boolean,
  confirmarSalida: (action: () => void) => void,
) {
  const [isRestoring, setIsRestoring] = useState(false);
  const restoringRef = useRef(false);
  // Los handlers de cierre anteriores al render también deben ver el POP.
  const isRestoringNow = useCallback(() => restoringRef.current, []);

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
        // confirmarSalida registra la salida pendiente antes de liberar esta
        // fase, sin un intervalo en que un cierre viejo pueda descartar datos.
        restoringRef.current = false;
        setIsRestoring(false);
        return;
      }
      const delta = nextIndex - initialIndex;
      if (!delta) return;
      // El dispatcher de arranque corre antes del listener de BrowserRouter:
      // el formulario no se desmonta mientras se restaura la entrada actual.
      event.stopImmediatePropagation();
      if (restoringDelta !== null) return;
      restoringDelta = delta;
      restoringRef.current = true;
      setIsRestoring(true);
      window.history.go(-delta);
    };
    const unsubscribe = subscribeDirtyHistoryGuard(onPopState);
    return () => {
      unsubscribe();
      restoringRef.current = false;
      setIsRestoring(false);
    };
  }, [enabled, confirmarSalida]);

  return { isRestoring, isRestoringNow };
}
