import { memo } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight, type LucideIcon } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { NavLink } from "@/components/layout/NavLink";
import { cn } from "@/lib/utils";
import { pluralS } from "@/lib/formatters";
import { trackNavEvent } from "@/services/observability/trackNavEvent";

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
  /** Rol efectivo del usuario (para tracking, opcional). */
  role?: string | null;
  /** ¿Está esta sección colapsada por preferencia del usuario? */
  isSectionCollapsed?: boolean;
  /** Alterna la sección colapsada. */
  onToggleSection?: (label: string) => void;
}

function isActive(
  pathname: string,
  search: string,
  path: string,
  exact: boolean,
  queriesHermanas: string[] = [],
): boolean {
  // v13.388.1 — Items de bandeja llevan query (`/proformas?estado=aceptada`):
  // sólo se marcan activos cuando la query actual coincide. El item base sigue
  // resaltando con cualquier otra query (`?tab=`, `?focus=`), salvo que la query
  // actual pertenezca a un item hermano de la misma ruta.
  const [rutaBase, query = ""] = path.split("?");
  const searchActual = search.startsWith("?") ? search.slice(1) : search;
  if (query) return pathname === rutaBase && searchActual === query;
  if (searchActual && queriesHermanas.includes(searchActual) && pathname === rutaBase) return false;
  if (rutaBase === "/" || exact) return pathname === rutaBase;
  return pathname === rutaBase || pathname.startsWith(`${rutaBase}/`);
}

/** Queries de otros items que apuntan a la misma ruta base que `item`. */
function queriesHermanasDe(items: SidebarItem[], item: SidebarItem): string[] {
  const base = item.url.split("?")[0];
  return items
    .filter((otro) => otro !== item && otro.url.split("?")[0] === base && otro.url.includes("?"))
    .map((otro) => otro.url.split("?")[1] ?? "");
}


/**
 * Bloque memoizado de un grupo del sidebar. Evita reconstruir cada `renderGroup`
 * en cada navegación: solo el grupo cuyo `pathname` activo cambia se re-renderea.
 *
 * v13.319.0 (Etapa 3): añade
 *  - Tracking fire-and-forget de clicks (`trackNavEvent`).
 *  - Encabezado colapsable con memoria + auto-expansión si la ruta activa
 *    vive en la sección (regla de oro: nunca esconder dónde estás parado).
 */
function SidebarGroupBlockBase({
  label,
  items,
  collapsed,
  pathname,
  role,
  isSectionCollapsed = false,
  onToggleSection,
}: Props) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { search } = useLocation();

  const hasActive = items.some((item) => {
    const exact = items.some((other) => other !== item && other.url.startsWith(`${item.url}/`));
    return isActive(pathname, search, item.url, exact, queriesHermanasDe(items, item));
  });

  const open = hasActive || !isSectionCollapsed;

  const handleNavigate = (item: SidebarItem) => {
    if (isMobile) setOpenMobile(false);
    trackNavEvent({
      source: "sidebar",
      item_url: item.url,
      item_title: item.title,
      section_label: label,
      role: role ?? null,
    });
  };

  const menu = (
    <SidebarGroupContent>
      <SidebarMenu>
        {items.map((item) => {
          const exact = items.some((other) => other !== item && other.url.startsWith(`${item.url}/`));
          const active = isActive(pathname, search, item.url, exact, queriesHermanasDe(items, item));
          const badge = item.badgeCount ?? 0;
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={active}
                tooltip={{
                  children: item.title,
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
                  end={item.url === "/" || items.some((other) => other !== item && other.url.startsWith(`${item.url}/`))}
                  onClick={() => handleNavigate(item)}
                  className={cn(
                    "hover:bg-sidebar-accent/10 hover:text-sidebar-foreground",
                    active && "bg-sidebar-accent/10 text-sidebar-foreground font-semibold",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
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
                      <TooltipContent side="right">{badge} alerta{pluralS(badge)} activa{pluralS(badge)}</TooltipContent>
                    </Tooltip>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroupContent>
  );

  // Modo icon-only: sin colapsable, comportamiento actual.
  if (collapsed) {
    return (
      <>
        <SidebarGroup>{menu}</SidebarGroup>
        <Separator className="my-2 mx-1" />
      </>
    );
  }

  return (
    <>
      <SidebarGroup>
        <Collapsible open={open} onOpenChange={() => onToggleSection?.(label)}>
          <CollapsibleTrigger
            aria-label={`Colapsar sección ${label}`}
            aria-expanded={open}
            className="flex w-full items-center justify-between px-3 py-2 text-label font-semibold uppercase tracking-wider text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
          >
            <span>{label}</span>
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform text-sidebar-foreground/60",
                open && "rotate-90",
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>{menu}</CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
      <Separator className="my-2 mx-1" />
    </>
  );
}

export const SidebarGroupBlock = memo(SidebarGroupBlockBase);
