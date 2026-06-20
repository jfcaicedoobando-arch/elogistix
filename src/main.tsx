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
import { queryClient } from "./lib/query/queryClient";

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

window.addEventListener("load", () => {
  clearChunkReloadFlag();
});

/**
 * Sentry + React Query persister se cargan de forma DIFERIDA fuera del
 * critical path. Esto saca `@sentry/react` (~150 KB) y
 * `@tanstack/react-query-persist-client` (~25 KB) del bundle inicial.
 *
 * 13.63.0: en lugar de esperar al `requestIdleCallback` para iniciar la
 * descarga (lo que dejaba una ventana ciega de hasta 3s al arrancar la app),
 * disparamos `import()` INMEDIATAMENTE — el browser baja el chunk en paralelo
 * con el render — y sólo diferimos la EJECUCIÓN de `initSentry()` /
 * `bootstrapQueryPersister()` al idle. Resultado: misma cobertura, menor
 * latencia hasta que Sentry empieza a capturar.
 */
const sentryModulePromise = import("./lib/observability/sentry/core");
const persisterModulePromise = import("./lib/query/persistBootstrap");

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
  void sentryModulePromise.then((m) => m.initSentry()).catch(() => undefined);
  void persisterModulePromise
    .then((m) => m.bootstrapQueryPersister(queryClient))
    .catch(() => undefined);
});

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider>
      <OrganizationProvider>
        <App />
      </OrganizationProvider>
    </AuthProvider>
  </ThemeProvider>
);
