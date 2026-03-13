import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function Layout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center border-b bg-card px-4 shrink-0 shadow-sm">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Plataforma de Operaciones
            </h1>
            <div className="ml-auto">
              <GlobalSearch />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
