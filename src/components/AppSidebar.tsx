import {
  LayoutDashboard,
  Ship,
  FileText,
  UserCheck,
  Truck,
  BarChart3,
  Anchor,
  ScrollText,
  ShieldCheck,
  LogOut,
  History,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Embarques", url: "/embarques", icon: Ship },
  { title: "Facturación", url: "/facturacion", icon: FileText },
  { title: "Clientes", url: "/clientes", icon: UserCheck },
  { title: "Proveedores", url: "/proveedores", icon: Truck },
  { title: "Reportes", url: "/reportes", icon: BarChart3 },
  { title: "Changelog", url: "/changelog", icon: ScrollText },
  { title: "Bitácora", url: "/bitacora", icon: History },
];

const adminItems = [
  { title: "Usuarios", url: "/usuarios", icon: ShieldCheck },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, role, signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const allItems = role === "admin" ? [...menuItems, ...adminItems] : menuItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Anchor className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground">
                Elogistix Shipping
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                Agente de Carga
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {allItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 space-y-2">
        {!collapsed && user && (
          <div className="text-xs text-sidebar-foreground/70 truncate">
            {user.email}
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
        {!collapsed && (
          <div className="text-xs text-sidebar-foreground/50">
            v3.3.0 · Operaciones MX
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
