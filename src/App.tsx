import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { ErrorDetailsDialog } from "@/components/ui/ErrorDetailsDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import RouteLoadingFallback from "./components/layout/RouteLoadingFallback";
import { BreadcrumbProvider } from "./contexts/BreadcrumbContext";
import { queryClient, queryPersister, shouldDehydrateCatalogQuery } from "./lib/queryClient";
import { AppRoutes } from "./routes";

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryPersister,
      maxAge: 24 * 60 * 60 * 1000, // 24h
      dehydrateOptions: {
        shouldDehydrateQuery: (query) =>
          shouldDehydrateCatalogQuery(query.queryKey, query.state.status),
      },
    }}
  >
    <TooltipProvider>
      <Toaster />
      <ErrorDetailsDialog />
      <BrowserRouter>
        <NuqsAdapter>
          <BreadcrumbProvider>
            <Suspense fallback={<RouteLoadingFallback />}>
              <AppRoutes />
            </Suspense>
          </BreadcrumbProvider>
        </NuqsAdapter>
      </BrowserRouter>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
