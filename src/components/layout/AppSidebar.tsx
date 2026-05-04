import { memo, forwardRef } from "react";
import {
  LayoutDashboard,
  Ship,
  FileText,
  UserCheck,
  Truck,
  Activity,
  ClipboardList,
  ScrollText,
  ShieldCheck,
  LogOut,
  History,
  Settings,
  BarChart3,
  ChevronUp,
  Sun,
  Moon,
  Building2,
  ShieldAlert,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
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
import { SidebarGroupBlock, type SidebarItem } from "@/components/layout/SidebarGroupBlock";

const dashboardItems: SidebarItem[] = [
  { title: "Principal", url: "/", icon: LayoutDashboard },
  { title: "Operaciones", url: "/operaciones", icon: Activity },
];

const gestionItems: SidebarItem[] = [
  { title: "Cotizaciones", url: "/cotizaciones", icon: ClipboardList },
  { title: "Embarques", url: "/embarques", icon: Ship },
  { title: "Pre-Facturación", url: "/facturacion", icon: FileText },
];

const reportesItems: SidebarItem[] = [
  { title: "Rentabilidad", url: "/reportes/rentabilidad", icon: BarChart3 },
];

const directorioItems: SidebarItem[] = [
  { title: "Clientes", url: "/clientes", icon: UserCheck },
  { title: "Proveedores", url: "/proveedores", icon: Truck },
];

const sistemaItems: SidebarItem[] = [
  { title: "Auditoría", url: "/auditoria", icon: ShieldAlert },
  { title: "Bitácora", url: "/bitacora", icon: History },
  { title: "Changelog", url: "/changelog", icon: ScrollText },
];

const adminItems: SidebarItem[] = [
  { title: "Usuarios", url: "/usuarios", icon: ShieldCheck },
  { title: "Configuración", url: "/configuracion", icon: Settings },
];

const superAdminItems: SidebarItem[] = [
  { title: "Panel Admin", url: "/admin", icon: Building2 },
];

const AppSidebarBase = forwardRef<HTMLDivElement>(function AppSidebarBase(_props, _ref) {
  const { state, isMobile } = useSidebar();
  // En móvil el sidebar abre como Sheet completo; nunca debe verse "colapsado"
  // (se mostrarían sólo íconos sin texto). Sólo colapsamos en desktop/tablet.
  const collapsed = !isMobile && state === "collapsed";
  const { pathname } = useLocation();
  const { user, role, effectiveRole, signOut } = useAuth();
  const { organization } = useOrganization();
  const { totalAlertas } = useSidebarAlerts();
  const { data: auditoriaCount = 0 } = useAuditoriaCount();
  const { theme, toggleTheme } = useTheme();

  const sistemaItemsConBadge = sistemaItems.map((it) =>
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
        <SidebarGroupBlock label="Dashboards" items={dashboardItems} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        <SidebarGroupBlock label="Gestión" items={gestionItems} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        <SidebarGroupBlock label="Reportes" items={reportesItems} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        <SidebarGroupBlock label="Directorio" items={directorioItems} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        <SidebarGroupBlock label="Sistema" items={sistemaItemsConBadge} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        {(effectiveRole === "admin" || role === "super_admin") && (
          <SidebarGroupBlock label="Administración" items={adminItems} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        )}
        {role === "super_admin" && (
          <SidebarGroupBlock label="Super Admin" items={superAdminItems} collapsed={collapsed} pathname={pathname} totalAlertas={totalAlertas} />
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2 group-data-[collapsible=icon]:p-2">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 w-full rounded-md p-2 text-left",
                  "hover:bg-sidebar-accent/15 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  collapsed && "justify-center p-1.5",
                )}
                aria-label="Menú de usuario"
              >
                <Avatar className="h-8 w-8 shrink-0 ring-1 ring-sidebar-border">
                  <AvatarFallback className="bg-muted text-foreground text-[11px] font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-sidebar-foreground truncate leading-tight">
                        {user.email}
                      </div>
                      {roleLabel && (
                        <div className="text-[10px] text-sidebar-foreground/65 truncate">
                          {roleLabel}
                        </div>
                      )}
                    </div>
                    <ChevronUp className="h-4 w-4 text-sidebar-foreground/50 shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={collapsed ? "right" : "top"}
              align={collapsed ? "start" : "end"}
              className="w-56"
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium truncate">{user.email}</span>
                  {roleLabel && <span className="text-[10px] text-muted-foreground">{roleLabel}</span>}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {theme === "dark" ? "Modo claro" : "Modo oscuro"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
