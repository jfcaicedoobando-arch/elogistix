import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
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
} from "./lib/ui/dynamicImportError";
import { queryClient } from "./lib/queryClient";

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

window.addEventListener("load", () => {
  clearChunkReloadFlag();
});

/**
 * Sentry + React Query persister se cargan de forma DIFERIDA fuera del
 * critical path (Etapa 5 sub-loop 2). Esto saca `@sentry/react` (~150 KB) y
 * `@tanstack/react-query-persist-client` (~25 KB) del bundle inicial.
 *
 * - Sentry: errores tempranos siguen siendo capturados por los listeners
 *   globales del navegador y se reenvían cuando init termina.
 * - Persister: durante los primeros ~ms tras el paint los catálogos no
 *   están hidratados; las queries refetchearán al montar (no hay regresión).
 */
const scheduleIdle = (cb: () => void) => {
  const w = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(() => cb(), { timeout: 3000 });
  } else {
    setTimeout(cb, 1500);
  }
};

scheduleIdle(() => {
  void import("./lib/sentry").then((m) => m.initSentry());
  void import("./lib/queryPersistBootstrap").then((m) =>
    m.bootstrapQueryPersister(queryClient),
  );
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ThemeProvider>
      <AuthProvider>
        <OrganizationProvider>
          <App />
        </OrganizationProvider>
      </AuthProvider>
    </ThemeProvider>
  </HelmetProvider>
);
