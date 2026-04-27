import { Suspense, useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Outlet } from "react-router-dom";
import { GlobalSearch } from "@/components/shared/GlobalSearch";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import RouteLoadingFallback from "@/components/layout/RouteLoadingFallback";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export function Layout() {
  // En tablet (<lg = 1024px) el sidebar arranca colapsado para liberar ancho útil.
  const [defaultOpen, setDefaultOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024
  );
  useEffect(() => {
    const onResize = () => setDefaultOpen(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-16 flex items-center gap-3 border-b bg-card/85 px-6 shrink-0 backdrop-blur supports-[backdrop-filter]:bg-card/70">
            <SidebarTrigger className="shrink-0" />
            <div className="h-5 w-px bg-border shrink-0" aria-hidden />
            <Breadcrumbs />
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <GlobalSearch />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-screen-2xl p-6">
              <ErrorBoundary>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
