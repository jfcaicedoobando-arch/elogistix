import { Ship, FileText, Receipt, LayoutDashboard, type LucideIcon } from "lucide-react";

export interface PortalNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { label: "Inicio", href: "/portal", icon: LayoutDashboard },
  { label: "Embarques", href: "/portal/embarques", icon: Ship },
  { label: "Cotizaciones", href: "/portal/cotizaciones", icon: FileText },
  { label: "Facturas", href: "/portal/facturas", icon: Receipt },
];

export const PORTAL_BREADCRUMB_MAP: Record<string, string> = {
  "/portal": "Inicio",
  "/portal/embarques": "Embarques",
  "/portal/cotizaciones": "Cotizaciones",
  "/portal/facturas": "Facturas",
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
