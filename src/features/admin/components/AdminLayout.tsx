import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { BreadcrumbProvider } from "@/lib/contexts/BreadcrumbContext";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { PageContainer } from "@/components/shared/PageContainer";

export function AdminLayout() {
  const location = useLocation();
  return (
    <BreadcrumbProvider>
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
              <PageContainer noSpacing>
                <ErrorBoundary resetKey={location.pathname}>
                  <Outlet />
                </ErrorBoundary>
              </PageContainer>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </BreadcrumbProvider>
  );
}
