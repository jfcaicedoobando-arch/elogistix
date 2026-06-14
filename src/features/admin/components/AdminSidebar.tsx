import {
  LayoutDashboard,
  Building2,
  Users,
  LogOut,
  Settings,
  ChevronUp,
  User,
  Activity,
} from "lucide-react";
import { NavLink } from "@/components/layout/NavLink";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandLockup } from "@/components/layout/BrandLockup";

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Organizaciones", url: "/admin/organizaciones", icon: Building2 },
  { title: "Usuarios", url: "/admin/usuarios", icon: Users },
  { title: "Diagnóstico", url: "/admin/diagnostico", icon: Activity },
  
  { title: "Configuración Global", url: "/admin/configuracion", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        {collapsed ? (
          <BrandLockup variant="icon" size="sm" />
        ) : (
          <BrandLockup variant="horizontal" size="sm" subtitle="Super Admin" />
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          {!collapsed && (
            <span className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              Administración
            </span>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
                        end={item.url === "/admin"}
                        className="hover:bg-sidebar-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                        activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-2 rounded-md px-2 py-2 hover:bg-sidebar-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Menú de usuario"
            >
              <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                {initials}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-medium text-sidebar-foreground truncate">
                      {user?.email}
                    </div>
                    <div className="text-[10px] text-sidebar-foreground/60">Super Admin</div>
                  </div>
                  <ChevronUp className="h-3.5 w-3.5 text-sidebar-foreground/60" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="h-4 w-4 mr-2" /> Mi perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
