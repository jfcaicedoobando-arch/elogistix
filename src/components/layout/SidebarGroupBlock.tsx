import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { NavLink } from "@/components/layout/NavLink";
import { cn } from "@/lib/utils";

export interface SidebarItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Si se define, se usa este conteo en lugar de `totalAlertas`. */
  badgeCount?: number;
}

interface Props {
  label: string;
  items: SidebarItem[];
  collapsed: boolean;
  pathname: string;
  totalAlertas: number;
}

function isActive(pathname: string, path: string): boolean {
  if (path === "/") return pathname === "/";
  return pathname.startsWith(path);
}

/**
 * Bloque memoizado de un grupo del sidebar. Evita reconstruir cada `renderGroup`
 * en cada navegación: solo el grupo cuyo `pathname` activo cambia se re-renderea.
 */
function SidebarGroupBlockBase({ label, items, collapsed, pathname, totalAlertas }: Props) {
  return (
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
              const active = isActive(pathname, item.url);
              const badge =
                item.badgeCount !== undefined
                  ? item.badgeCount
                  : item.url === "/"
                    ? totalAlertas
                    : 0;
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.title}
                    className={cn(
                      "relative",
                      active &&
                        "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:bg-sidebar-primary before:rounded-r-full",
                    )}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent/10 text-sidebar-foreground font-semibold"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
                      {badge > 0 && !collapsed && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-5 min-w-5 px-1 text-[10px] font-bold rounded-full shrink-0"
                        >
                          {badge > 99 ? "99+" : badge}
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
}

export const SidebarGroupBlock = memo(SidebarGroupBlockBase);
