import { memo, forwardRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/ThemeContext";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import { useSidebarAlerts } from "@/hooks/shared/useSidebarAlerts";
import { useAuditoriaCount } from "@/hooks/auditoria/useAuditoria";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/constants/appVersion";
import { OrgSwitcher } from "@/components/layout/OrgSwitcher";
import { SidebarGroupBlock } from "@/components/layout/SidebarGroupBlock";
import { SidebarUserMenu } from "@/components/layout/SidebarUserMenu";
import {
  SIDEBAR_DASHBOARD_ITEMS,
  SIDEBAR_GESTION_ITEMS,
  SIDEBAR_REPORTES_ITEMS,
  SIDEBAR_DIRECTORIO_ITEMS,
  SIDEBAR_SISTEMA_ITEMS,
  SIDEBAR_ADMIN_ITEMS,
  SIDEBAR_SUPER_ADMIN_ITEMS,
} from "@/components/layout/sidebarItems";

// Avatar import kept only for tree-shaking parity; not directly used here.
void Avatar;

const AppSidebarBase = forwardRef<HTMLDivElement>(function AppSidebarBase(_props, _ref) {
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const { pathname } = useLocation();
  const { user, role, effectiveRole, signOut } = useAuth();
  const { totalAlertas } = useSidebarAlerts();
  const { data: auditoriaCount = 0 } = useAuditoriaCount();
  const { theme, toggleTheme } = useTheme();

  const sistemaItemsConBadge = SIDEBAR_SISTEMA_ITEMS.map((it) =>
    it.url === "/auditoria" ? { ...it, badgeCount: auditoriaCount } : it,
  );

  const userInitials = (user?.email ?? "?")
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
  const roleLabel = effectiveRole === "super_admin"
    ? "Super Admin"
    : effectiveRole
      ? effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1)
      : "";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 border-b border-sidebar-border flex items-center px-4 py-0 group-data-[collapsible=icon]:px-2">
        <div className={cn("flex items-center w-full", collapsed && "justify-center")}>
          <BrandLockup
            variant={collapsed ? "icon" : "horizontal"}
            size="sm"
            subtitle={collapsed ? undefined : "Plataforma de Forwarders"}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <div className="px-2 mb-2">
          <OrgSwitcher collapsed={collapsed} />
        </div>
        <SidebarGroupBlock label="Dashboards" items={SIDEBAR_DASHBOARD_ITEMS} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        <SidebarGroupBlock label="Gestión" items={SIDEBAR_GESTION_ITEMS} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        <SidebarGroupBlock label="Reportes" items={SIDEBAR_REPORTES_ITEMS} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        <SidebarGroupBlock label="Directorio" items={SIDEBAR_DIRECTORIO_ITEMS} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        <SidebarGroupBlock label="Sistema" items={sistemaItemsConBadge} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        {(effectiveRole === "admin" || role === "super_admin") && (
          <SidebarGroupBlock label="Administración" items={SIDEBAR_ADMIN_ITEMS} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        )}
        {role === "super_admin" && (
          <SidebarGroupBlock label="Super Admin" items={SIDEBAR_SUPER_ADMIN_ITEMS} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2 group-data-[collapsible=icon]:p-2">
        {user && (
          <SidebarUserMenu
            email={user.email ?? ""}
            initials={userInitials}
            roleLabel={roleLabel}
            collapsed={collapsed}
            theme={theme}
            onToggleTheme={toggleTheme}
            onSignOut={signOut}
          />
        )}
        {!collapsed && (
          <div className="text-[11px] text-sidebar-foreground/55 tabular-nums px-1">
            v{APP_VERSION}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
});

export const AppSidebar = memo(AppSidebarBase);
