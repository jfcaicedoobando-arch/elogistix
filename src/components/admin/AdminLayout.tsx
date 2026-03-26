import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AdminLayout() {
  const { organizations, organizationId, setActiveOrganization, isSuperAdmin } = useOrganization();

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
            {isSuperAdmin && organizations.length > 1 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Organización:</span>
                <Select value={organizationId ?? ""} onValueChange={setActiveOrganization}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Seleccionar org" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
