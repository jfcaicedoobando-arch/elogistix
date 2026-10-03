/**
 * Dispatcher instalado antes de montar BrowserRouter. En window, popstate
 * corre en AT_TARGET: capture no adelanta un listener registrado después.
 */
type HistoryGuard = (event: PopStateEvent) => void;
const guards = new Set<HistoryGuard>();
let installed = false;

function dispatch(event: PopStateEvent) {
  // Sólo la última captura activa decide sobre una navegación compartida.
  const active = [...guards].at(-1);
  active?.(event);
}

export function registerDirtyHistoryGuard() {
  if (installed) return;
  window.addEventListener("popstate", dispatch);
  installed = true;
}

export function subscribeDirtyHistoryGuard(guard: HistoryGuard) {
  guards.add(guard);
  return () => { guards.delete(guard); };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("popstate", dispatch);
    installed = false;
    guards.clear();
  });
}
