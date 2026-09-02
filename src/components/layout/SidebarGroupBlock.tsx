import { memo } from "react";
import { useLocation } from "react-router-dom";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { trackNavEvent } from "@/services/observability/trackNavEvent";
import { isActive, queriesHermanasDe, esExacto, type SidebarItem } from "@/components/layout/sidebarActivo";
import { SidebarGroupHeader } from "@/components/layout/SidebarGroupHeader";
import { SidebarMenuItemBlock } from "@/components/layout/SidebarMenuItemBlock";

export type { SidebarItem };

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

  const hasActive = items.some((item) =>
    isActive(pathname, search, item.url, esExacto(items, item), queriesHermanasDe(items, item)),
  );

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
        {items.map((item) => (
          <SidebarMenuItemBlock
            key={item.title}
            item={item}
            items={items}
            pathname={pathname}
            search={search}
            collapsed={collapsed}
            onNavigate={handleNavigate}
          />
        ))}
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
          <SidebarGroupHeader label={label} hasActive={hasActive} open={open} />
          <CollapsibleContent>{menu}</CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
      <Separator className="my-2 mx-1" />
    </>
  );
}

export const SidebarGroupBlock = memo(SidebarGroupBlockBase);
