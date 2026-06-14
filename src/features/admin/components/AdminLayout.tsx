import { Outlet, useLocation, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ChevronRight, Home } from "lucide-react";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

const labels: Record<string, string> = {
  admin: "Admin",
  organizaciones: "Organizaciones",
  usuarios: "Usuarios",
  configuracion: "Configuración",
};

function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  let acc = "";
  return (
    <nav aria-label="Ruta de navegación" className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
      <Link to="/admin" className="flex items-center hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {parts.slice(1).map((p, i) => {
        acc = `/admin/${parts.slice(1, i + 2).join("/")}`;
        const isLast = i === parts.length - 2;
        const label = labels[p] ?? decodeURIComponent(p);
        return (
          <div key={acc} className="flex items-center gap-1 min-w-0">
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            {isLast ? (
              <span className="text-foreground font-medium truncate">{label}</span>
            ) : (
              <Link to={acc} className="hover:text-foreground transition-colors truncate">{label}</Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 shrink-0 gap-3">
            <SidebarTrigger className="mr-1" aria-label="Alternar barra lateral" />
            <Breadcrumbs />
            <div className="ml-auto flex items-center gap-2">
              <FeedbackButton />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-screen-2xl p-6">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
