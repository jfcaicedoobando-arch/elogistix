import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./lib/contexts/AuthContext";
import { OrganizationProvider } from "./lib/contexts/OrganizationContext";
import { ThemeProvider } from "./lib/contexts/ThemeContext";
import { APP_VERSION } from "./constants/appVersion";
import {
  clearChunkReloadFlag,
  clearPersistedQueryCache,
  getStoredAppVersion,
  setStoredAppVersion,
} from "./lib/browserStorage";
import {
  isDynamicImportError,
  tryReloadForChunkError,
} from "./lib/errors/dynamicImportError";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/query/queryClient";
import { renderBootstrapFallback } from "./lib/bootstrap/renderBootstrapFallback";

const previousVersion = getStoredAppVersion();
if (previousVersion !== APP_VERSION) {
  queryClient.clear();
  clearPersistedQueryCache();
  setStoredAppVersion(APP_VERSION);
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  tryReloadForChunkError();
});

// React.lazy() rechaza la promesa sin disparar vite:preloadError cuando el
// fallo viene del propio `import()`. Capturarlo aquí evita ruido en Sentry
// y garantiza el reload de auto-recuperación.
window.addEventListener("unhandledrejection", (event) => {
  if (!isDynamicImportError(event.reason)) return;
  event.preventDefault();
  tryReloadForChunkError();
});

// React.lazy con un chunk stale lanza síncronamente dentro del reconciler
// (`Cannot read properties of undefined (reading 'default')`). Ese error no
// pasa por `unhandledrejection` ni por `vite:preloadError`, así que lo
// capturamos por `window.onerror` y disparamos el reload de recuperación.
window.addEventListener("error", (event) => {
  if (!isDynamicImportError(event.error ?? event.message)) return;
  event.preventDefault();
  tryReloadForChunkError();
});

// No liberar la guarda apenas termina `load`: las rutas React.lazy y los
// módulos diferidos suelen resolverse después. Si uno falla a los 1–3 s,
// limpiar aquí provocaba un bucle de recargas (la app aparecía y desaparecía).
// Ocho segundos sin fallos indican que el grafo de módulos ya quedó estable.
window.addEventListener("load", () => {
  window.setTimeout(clearChunkReloadFlag, 8_000);
});

/**
 * Sentry + React Query persister se cargan de forma DIFERIDA fuera del
 * critical path. Esto saca `@sentry/react` (~150 KB) y
 * `@tanstack/react-query-persist-client` (~25 KB) del bundle inicial.
 *
 * 13.114.19: `initSentry()` ahora se dispara INMEDIATAMENTE (sin esperar
 * `requestIdleCallback`) para cerrar la ventana ciega ~1.5 s en la que los
 * crashes del primer render no llegaban a Sentry. La carga del módulo sigue
 * siendo dinámica (chunk separado, no bloquea el bundle inicial); sólo se
 * remueve el `scheduleIdle` que retrasaba la EJECUCIÓN. El persister sí
 * sigue al idle porque hidratar el cache no es crítico para captura de
 * errores.
 */
const sentryModulePromise = import("./lib/observability/sentry/core");
const persisterModulePromise = import("./lib/query/persistBootstrap");

void sentryModulePromise.then((m) => m.initSentry()).catch(() => undefined);

const scheduleIdle = (cb: () => void) => {
  const w = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(() => cb(), { timeout: 1500 });
  } else {
    setTimeout(cb, 200);
  }
};

scheduleIdle(() => {
  void persisterModulePromise
    .then((m) => m.bootstrapQueryPersister(queryClient))
    .catch(() => undefined);
});

// Red de seguridad de arranque: si el montaje raíz lanza antes del primer
// render (p. ej. un proveedor de contexto que falla al inicializar), el DOM
// quedaría vacío = pantalla en blanco sin explicación. Aquí lo convertimos en
// una pantalla de recuperación con botón "Recargar".
try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {/* QueryClientProvider debe envolver a AuthProvider: el perfil de usuario
          se resuelve con TanStack Query (M9). */}
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <OrganizationProvider>
              <App />
            </OrganizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  );
} catch (error) {
  renderBootstrapFallback(error);
}

