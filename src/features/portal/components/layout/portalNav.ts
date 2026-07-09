import { Ship, FileText, Receipt, LayoutDashboard, User, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/constants/routes";

export interface PortalNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { label: "Inicio", href: ROUTES.PORTAL, icon: LayoutDashboard },
  { label: "Embarques", href: ROUTES.PORTAL_EMBARQUES, icon: Ship },
  { label: "Cotizaciones", href: ROUTES.PORTAL_COTIZACIONES, icon: FileText },
  { label: "Facturas", href: ROUTES.PORTAL_FACTURAS, icon: Receipt },
  { label: "Perfil", href: ROUTES.PORTAL_PERFIL, icon: User },
];

export const PORTAL_BREADCRUMB_MAP: Record<string, string> = {
  [ROUTES.PORTAL]: "Inicio",
  [ROUTES.PORTAL_EMBARQUES]: "Embarques",
  [ROUTES.PORTAL_COTIZACIONES]: "Cotizaciones",
  [ROUTES.PORTAL_FACTURAS]: "Facturas",
  [ROUTES.PORTAL_PERFIL]: "Perfil",
};

export function getActiveSectionLabel(pathname: string): string | null {
  if (pathname === "/portal") return "Inicio";
  for (const item of PORTAL_NAV_ITEMS) {
    if (item.href !== "/portal" && pathname.startsWith(item.href)) return item.label;
  }
  return null;
}

export function isPortalNavItemActive(href: string, pathname: string): boolean {
  return href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
}
