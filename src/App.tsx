import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { RouteToastCleanup } from "@/components/shared/RouteToastCleanup";
import { ErrorDetailsDialog } from "@/components/ui/ErrorDetailsDialog";
import { TooltipProvider } from "@/components/ui/tooltip";

import { BrowserRouter } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import RouteLoadingFallback from "./components/layout/RouteLoadingFallback";
import { BreadcrumbProvider } from "./lib/contexts/BreadcrumbContext";

import { AppRoutes } from "./routes";
import { DemoModeBanner } from "@/features/marketing/components/DemoModeBanner";
import { useRadixPointerEventsRescue } from "@/hooks/shared";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useSyncSentryErrorContext } from "@/lib/observability/hooks/useSyncSentryErrorContext";

// 13.275.0 — Devtools de TanStack Query sólo en dev (lazy → 0 KB en prod).
// 13.823.71 — Los devtools leen `navigator.language` al evaluar su módulo y
// lanzan RangeError "Incorrect locale information provided" cuando el entorno
// expone un locale no estándar (p. ej. `en-US@posix`). Se omiten en ese caso:
// son una herramienta de desarrollo, no deben ensuciar la consola.
const localeValido = (): boolean => {
  try {
    new Intl.Locale(navigator.language || "en-US");
    return true;
  } catch {
    return false;
  }
};

const ReactQueryDevtools = import.meta.env.DEV && localeValido()
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : null;


const SentryErrorContextSync = () => {
  useSyncSentryErrorContext();
  return null;
};

const App = () => {
  useRadixPointerEventsRescue();
  return (
  // F2 (13.65.0): ErrorBoundary raíz — captura crashes en BrowserRouter,
  // providers (Tooltip/QueryClient/Nuqs) y rutas públicas (landing, login,
  // tracking-publico). El boundary interno de Layout sólo cubría el área
  // autenticada, dejando pantallas en blanco fuera de ella sin reporte.
  <ErrorBoundary>
    <TooltipProvider>
      <Toaster />
      <ErrorDetailsDialog />
      <BrowserRouter>
        <RouteToastCleanup />
        <NuqsAdapter>
          <BreadcrumbProvider>
            <SentryErrorContextSync />
            <DemoModeBanner />
            <Suspense fallback={<RouteLoadingFallback />}>
              <AppRoutes />
            </Suspense>
          </BreadcrumbProvider>
        </NuqsAdapter>
      </BrowserRouter>
    </TooltipProvider>
    {ReactQueryDevtools ? (
      <Suspense fallback={null}>
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      </Suspense>
    ) : null}
  </ErrorBoundary>

  );
};

export default App;
