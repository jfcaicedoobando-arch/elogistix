
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
  User,
  ChevronUp,
  Sun,
  Moon,
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
import { NavLink } from "@/components/layout/NavLink";
import librecargaLogo from "@/assets/librecarga-logo.png";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSidebarAlerts } from "@/hooks/shared/useSidebarAlerts";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { chunk0 } from "@/content/changelog/v8/chunks/0";

const APP_VERSION = chunk0[0]?.version ?? "—";

const dashboardItems = [
  { title: "Principal", url: "/", icon: LayoutDashboard },
  { title: "Operaciones", url: "/operaciones", icon: Activity },
];

const gestionItems = [
  { title: "Cotizaciones", url: "/cotizaciones", icon: ClipboardList },
  { title: "Embarques", url: "/embarques", icon: Ship },
  { title: "Pre-Facturación", url: "/facturacion", icon: FileText },
];

const reportesItems = [
  { title: "Rentabilidad", url: "/reportes/rentabilidad", icon: BarChart3 },
];

const directorioItems = [
  { title: "Clientes", url: "/clientes", icon: UserCheck },
  { title: "Proveedores", url: "/proveedores", icon: Truck },
];

const sistemaItems = [
  { title: "Bitácora", url: "/bitacora", icon: History },
  { title: "Changelog", url: "/changelog", icon: ScrollText },
];

const adminItems = [
  { title: "Usuarios", url: "/usuarios", icon: ShieldCheck },
  { title: "Configuración", url: "/configuracion", icon: Settings },
];

// Import Building2 for admin link
import { Building2 } from "lucide-react";
import { OrgSwitcher } from "@/components/layout/OrgSwitcher";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, role, effectiveRole, signOut } = useAuth();
  const { organization } = useOrganization();
  const { totalAlertas } = useSidebarAlerts();
  const { theme, toggleTheme } = useTheme();

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

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const renderGroup = (label: string, items: typeof dashboardItems) => (
    <>
      <SidebarGroup>
        {!collapsed && (
          <span className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/65">
            {label}
          </span>
        )}
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => {
              const active = isActive(item.url);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.title}
                    className={cn(
                      "relative",
                      // Rail vertical en item activo — visible en expanded y collapsed
                      active &&
                        "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:bg-sidebar-primary before:rounded-r-full",
                    )}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex-1 truncate">{item.title}</span>
                      )}
                      {/* Badge de alertas en Principal */}
                      {item.url === "/" && totalAlertas > 0 && !collapsed && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-5 min-w-5 px-1 text-[10px] font-bold rounded-full shrink-0"
                        >
                          {totalAlertas}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <Separator className="my-2 mx-1" />
    </>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 border-b border-sidebar-border flex items-center px-4 py-0 group-data-[collapsible=icon]:px-2">
        <div className={cn("flex items-center gap-3 w-full", collapsed && "justify-center gap-0")}>
          <img
            src={librecargaLogo}
            alt="Libre Carga Logo"
            className={cn(
              "rounded-xl object-contain bg-white p-1 ring-1 ring-sidebar-border dark:ring-0 shadow-card shrink-0",
              collapsed ? "h-9 w-9" : "h-10 w-10",
            )}
          />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold tracking-tight text-sidebar-foreground leading-tight">
                Libre Carga
              </span>
              <span className="text-xs text-sidebar-foreground/60 truncate">
                {organization?.nombre ?? "Agente de Carga"}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <div className="px-2 mb-2">
          <OrgSwitcher collapsed={collapsed} />
        </div>
        {renderGroup("Dashboards", dashboardItems)}
        {renderGroup("Gestión", gestionItems)}
        {renderGroup("Reportes", reportesItems)}
        {renderGroup("Directorio", directorioItems)}
        {renderGroup("Sistema", sistemaItems)}
        {(effectiveRole === "admin" || role === "super_admin") && renderGroup("Administración", adminItems)}
        {role === "super_admin" && renderGroup("Super Admin", [
          { title: "Panel Admin", url: "/admin", icon: Building2 },
        ])}
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
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-[11px] font-semibold">
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
            v{APP_VERSION} · Libre Carga
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
