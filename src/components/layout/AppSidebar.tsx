import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
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

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const renderGroup = (label: string, items: typeof dashboardItems) => (
    <>
      <SidebarGroup>
        {!collapsed && (
          <span className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
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
            className="h-8 w-8 rounded-lg object-contain bg-white p-0.5 ring-1 ring-sidebar-border dark:ring-0 shrink-0"
          />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-sidebar-foreground">
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

      <SidebarFooter className="border-t border-sidebar-border p-4 space-y-2 group-data-[collapsible=icon]:p-2">
        {!collapsed && user && (
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="text-xs text-sidebar-foreground/70 truncate">
              {user.email}
            </div>
            {effectiveRole && (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="w-fit text-[10px] px-1.5 py-0 capitalize border-sidebar-border text-sidebar-foreground/50 cursor-help">
                    {effectiveRole === "super_admin" ? "Super Admin" : effectiveRole}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  {effectiveRole === "super_admin" && "Acceso total a todas las organizaciones y configuración global de la plataforma."}
                  {effectiveRole === "admin" && "Gestión completa de su organización: usuarios, configuración, embarques y facturación."}
                  {effectiveRole === "operador" && "Crear y editar embarques, cotizaciones y documentos operativos."}
                  {effectiveRole === "viewer" && "Solo lectura: puede consultar información pero no crear ni modificar registros."}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
        {collapsed ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground"
                onClick={signOut}
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Cerrar sesión
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            <span className="ml-2">Cerrar sesión</span>
          </Button>
        )}
        {!collapsed && (
          <div className="text-[11px] text-sidebar-foreground/50 tabular-nums">
            v{APP_VERSION} · Libre Carga
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
