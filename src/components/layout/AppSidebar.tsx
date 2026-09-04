import { memo, forwardRef } from "react";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";


import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCopyText } from "@/hooks/shared";
import { APP_VERSION } from "@/constants/appVersion";
import { OrgSwitcher } from "@/components/layout/OrgSwitcher";
import { OrgBadge } from "@/components/layout/OrgBadge";
import { SidebarGroupBlock } from "@/components/layout/SidebarGroupBlock";
import { SidebarUserMenu } from "@/components/layout/SidebarUserMenu";
import { useAppSidebarSections } from "@/hooks/layout";
import { useSidebarCollapse } from "@/hooks/layout/useSidebarCollapse";
import { obtenerEtiquetaRol } from "@/features/admin/domain/roles/roleCatalog";


function computeUserInitials(email: string | undefined): string {
  return (email ?? "?")
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function computeRoleLabel(effectiveRole: string | null | undefined): string {
  // R-13: usar el catálogo de roles en vez de capitalizar el enum a mano
  // ("Ejecutivo_pricing" → "Ejecutivo pricing").
  if (!effectiveRole) return "";
  return obtenerEtiquetaRol(effectiveRole);
}


const AppSidebarBase = forwardRef<HTMLDivElement>(function AppSidebarBase(_props, _ref) {
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const { pathname } = useLocation();
  const { user, effectiveRole, signOut } = useAuth();
  
  const { theme, toggleTheme } = useTheme();
  const sections = useAppSidebarSections();
  const { isCollapsed: isSectionCollapsed, toggle: toggleSection } = useSidebarCollapse();

  const userInitials = computeUserInitials(user?.email ?? undefined);
  const roleLabel = computeRoleLabel(effectiveRole);
  // VB-25: la versión del pie es copiable (útil al levantar tickets de soporte).
  const copy = useCopyText();
  const copiarVersion = () =>
    void copy(`v${APP_VERSION}`, {
      successMessage: `Versión v${APP_VERSION} copiada`,
      errorTitle: "No se pudo copiar la versión",
      method: "AppSidebar.copiarVersion",
    });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 shrink-0 border-b border-sidebar-border flex items-center px-4 py-0 group-data-[collapsible=icon]:px-2">
        <div className={cn("flex items-center w-full", collapsed && "justify-center")}>
          <BrandLockup
            variant={collapsed ? "icon" : "horizontal"}
            size="sm"
            subtitle={collapsed ? undefined : "Plataforma para agentes de carga"}
          />
        </div>
      </SidebarHeader>

      <SidebarContent
        ref={railRef}
        className="relative px-2 py-4 group-data-[collapsible=icon]:py-2 [scrollbar-width:thin] [scrollbar-color:hsl(var(--sidebar-foreground)/0.3)_transparent]"
      >
        <div className="px-2 mb-2 space-y-2 shrink-0">
          <OrgSwitcher collapsed={collapsed} />
          <OrgBadge collapsed={collapsed} />
        </div>
        {sections.map((section, i) => (
          <SidebarGroupBlock
            key={section.label}
            label={section.label}
            items={section.items}
            collapsed={collapsed}
            pathname={pathname}
            role={effectiveRole}
            isSectionCollapsed={isSectionCollapsed(section.label)}
            onToggleSection={toggleSection}
            esUltimoGrupo={i === sections.length - 1}
          />
        ))}
        {/* VB-49: pista de desplazamiento cuando hay accesos fuera de la vista
            (típico en 1280x720 con el menú colapsado). */}
        {estadoRail.hayArriba && (
          <div
            data-testid="rail-scroll-arriba"
            aria-hidden="true"
            className="pointer-events-none sticky top-0 -mt-2 h-4 shrink-0 bg-gradient-to-b from-sidebar to-transparent"
          />
        )}
        {estadoRail.hayAbajo && (
          <div
            data-testid="rail-scroll-abajo"
            aria-hidden="true"
            className="pointer-events-none sticky bottom-0 -mb-2 h-4 shrink-0 bg-gradient-to-t from-sidebar to-transparent"
          />
        )}
      </SidebarContent>


      <SidebarFooter className="shrink-0 border-t border-sidebar-border p-3 space-y-2 group-data-[collapsible=icon]:p-2">
        {user && (
          <SidebarUserMenu
            email={user.email ?? ""}
            displayName={(user.user_metadata?.full_name as string | undefined) ?? null}
            initials={userInitials}
            roleLabel={roleLabel}
            collapsed={collapsed}
            theme={theme}
            onToggleTheme={toggleTheme}
            onSignOut={signOut}
          />
        )}
        {!collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={copiarVersion}
                aria-label={`Versión ${APP_VERSION}, clic para copiar`}
                className="text-label text-sidebar-foreground/55 tabular-nums px-1 transition-colors hover:text-sidebar-foreground cursor-copy"
              >
                v{APP_VERSION}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Versión {APP_VERSION} · clic para copiar
            </TooltipContent>
          </Tooltip>
        )}
      </SidebarFooter>
    </Sidebar>
  );
});

export const AppSidebar = memo(AppSidebarBase);
