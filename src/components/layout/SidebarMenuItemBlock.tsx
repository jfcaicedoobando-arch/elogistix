import { NavLink } from "@/components/layout/NavLink";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { pluralS } from "@/lib/formatters";
import { isActive, queriesHermanasDe, esExacto, type SidebarItem } from "@/components/layout/sidebarActivo";

interface Props {
  item: SidebarItem;
  items: SidebarItem[];
  pathname: string;
  search: string;
  collapsed: boolean;
  onNavigate: (item: SidebarItem) => void;
}

/**
 * Ítem individual del menú del sidebar. Extraído de `SidebarGroupBlock`
 * (Power of 10: archivos ≤200 líneas) sin cambiar comportamiento.
 */
export function SidebarMenuItemBlock({ item, items, pathname, search, collapsed, onNavigate }: Props) {
  const exact = esExacto(items, item);
  const active = isActive(pathname, search, item.url, exact, queriesHermanasDe(items, item));
  const badge = item.badgeCount ?? 0;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={{
          children:
            badge > 0 ? (
              <span className="flex flex-col gap-0.5">
                <span>{item.title}</span>
                <span className="text-2xs font-normal opacity-80">
                  {item.badgeHint ?? `${badge} alerta${pluralS(badge)} activa${pluralS(badge)}`}
                </span>
              </span>
            ) : (
              item.title
            ),
          className:
            "bg-sidebar text-sidebar-foreground border-sidebar-border shadow-overlay font-medium",
          sideOffset: 8,
        }}
        className={cn(
          "relative",
          active &&
            "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:bg-sidebar-primary before:rounded-r-full",
        )}
      >
        <NavLink
          to={item.url}
          end={item.url === "/" || exact}
          aria-label={item.title}
          onClick={() => onNavigate(item)}
          className={cn(
            "hover:bg-sidebar-accent/10 hover:text-sidebar-foreground",
            active && "bg-sidebar-accent/10 text-sidebar-foreground font-semibold",
          )}
        >
          <span className="relative shrink-0">
            <item.icon className="h-4 w-4" />
            {/* VB-41: en el rail colapsado el badge numérico no cabe;
                se sustituye por UN solo dot sobre la esquina del icono
                (v13.823.23: antes se pintaban dos dots). El desglose
                viaja en el tooltip del propio botón. */}
            {collapsed && badge > 0 && (
              <span
                aria-label={`${badge} alerta${pluralS(badge)} activa${pluralS(badge)}`}
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive ring-1 ring-sidebar"
              />
            )}
          </span>
          {!collapsed && <span className="flex-1 truncate">{item.title}</span>}

          {badge > 0 && !collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="destructive"
                  aria-label={`${badge} alertas`}
                  className="ml-auto h-5 min-w-5 px-1 text-2xs font-bold rounded-full shrink-0"
                >
                  {badge > 99 ? "99+" : badge}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="right">
                {item.badgeHint ?? `${badge} alerta${pluralS(badge)} activa${pluralS(badge)}`}
              </TooltipContent>
            </Tooltip>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
