import { memo, forwardRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import { useSidebarAlerts } from "@/hooks/shared";
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
import { useAppSidebarSections } from "@/hooks/layout";

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
  if (effectiveRole === "super_admin") return "Super Admin";
  if (!effectiveRole) return "";
  return effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1);
}

const AppSidebarBase = forwardRef<HTMLDivElement>(function AppSidebarBase(_props, _ref) {
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const { pathname } = useLocation();
  const { user, effectiveRole, signOut } = useAuth();
  const { totalAlertas } = useSidebarAlerts();
  const { theme, toggleTheme } = useTheme();
  const sections = useAppSidebarSections();

  const userInitials = computeUserInitials(user?.email ?? undefined);
  const roleLabel = computeRoleLabel(effectiveRole);

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
        {sections.map((section) => (
          <SidebarGroupBlock
            key={section.label}
            label={section.label}
            items={section.items}
            collapsed={collapsed}
            pathname={pathname}
            totalAlertas={totalAlertas}
          />
        ))}
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
