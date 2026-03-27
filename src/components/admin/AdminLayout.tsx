import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center border-b bg-card px-4 shrink-0 shadow-sm gap-4">
            <SidebarTrigger className="mr-2" />
            <h1 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Panel de Administración
            </h1>
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
