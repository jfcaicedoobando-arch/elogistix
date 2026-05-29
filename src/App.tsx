import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ErrorDetailsDialog } from "@/components/ui/ErrorDetailsDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import RouteLoadingFallback from "./components/layout/RouteLoadingFallback";
import { BreadcrumbProvider } from "./contexts/BreadcrumbContext";
import { queryClient } from "./lib/queryClient";
import { AppRoutes } from "./routes";

const App = () => (
  <QueryClientProvider client={queryClient}>
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
  </QueryClientProvider>
);

export default App;
