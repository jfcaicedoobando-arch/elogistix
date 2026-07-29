import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ErrorDetailsDialog } from "@/components/ui/ErrorDetailsDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import RouteLoadingFallback from "./components/layout/RouteLoadingFallback";
import { BreadcrumbProvider } from "./lib/contexts/BreadcrumbContext";
import { queryClient } from "./lib/query/queryClient";
import { AppRoutes } from "./routes";
import { DemoModeBanner } from "@/features/marketing/components/DemoModeBanner";
import { useRadixPointerEventsRescue } from "@/hooks/shared";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useSyncSentryErrorContext } from "@/lib/observability/hooks/useSyncSentryErrorContext";

// 13.275.0 — Devtools de TanStack Query sólo en dev (lazy → 0 KB en prod).
const ReactQueryDevtools = import.meta.env.DEV
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
