import { Suspense, useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { GlobalSearch } from "@/components/shared/GlobalSearch";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { PageContainer } from "@/components/shared/PageContainer";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import RouteLoadingFallback from "@/components/layout/RouteLoadingFallback";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { NotificacionesPopover } from "@/components/layout/NotificacionesPopover";
import { useIsMobile } from "@/hooks/shared/useIsMobile";
import { TenantContextBanner } from "@/components/layout/TenantContextBanner";
import { SeleccionaOrganizacion } from "@/components/layout/SeleccionaOrganizacion";
import { useOrganization } from "@/lib/contexts/OrganizationContext";


export function Layout() {
  const location = useLocation();
  // En tablet (<lg = 1024px) el sidebar arranca colapsado para liberar ancho útil.
  const [defaultOpen, setDefaultOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024
  );
  useEffect(() => {
    const onResize = () => setDefaultOpen(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = useIsMobile();
  const { requiereSeleccionOrg, loading } = useOrganization();


  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="min-h-dvh flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 h-11 sm:h-12 flex items-center gap-2 sm:gap-3 border-b border-border/60 bg-card/95 px-3 sm:px-6 shrink-0 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            {isMobile ? (
              <SidebarTrigger className="shrink-0 h-11 w-11" />

            ) : (
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Colapsar / expandir menú · <kbd className="ml-1 rounded bg-muted px-1 py-0.5 text-2xs font-mono">⌘B</kbd>
                </TooltipContent>
              </Tooltip>
            )}
            <div className="h-5 w-px bg-border shrink-0" aria-hidden />
            <Breadcrumbs />
            <div className="ml-auto flex items-center gap-0.5 sm:gap-2 shrink-0 [&_button[aria-label]:not([data-testid=global-search-trigger])]:h-11 [&_button[aria-label]:not([data-testid=global-search-trigger])]:w-11 sm:[&_button[aria-label]:not([data-testid=global-search-trigger])]:h-9 sm:[&_button[aria-label]:not([data-testid=global-search-trigger])]:w-9">
              <GlobalSearch />
              <NotificacionesPopover />
              <div className="hidden sm:contents">
                <FeedbackButton />
              </div>
              <ThemeToggle />
            </div>
          </header>
          <TenantContextBanner />
          <main className="flex-1 overflow-auto">
            <PageContainer noSpacing>
              <ErrorBoundary resetKey={location.pathname}>
                <Suspense fallback={<RouteLoadingFallback />}>
                  {/* RG6: mientras el contexto restaura el tenant del super
                      admin no se evalúa `requiereSeleccionOrg`; si no, la
                      pantalla de selección parpadea en cada recarga. */}
                  {loading ? (
                    <RouteLoadingFallback />
                  ) : requiereSeleccionOrg ? (
                    <SeleccionaOrganizacion />
                  ) : (
                    <Outlet />
                  )}
                </Suspense>
              </ErrorBoundary>
            </PageContainer>
          </main>


        </div>
      </div>
    </SidebarProvider>
  );
}
