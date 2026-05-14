import { useMemo } from "react";
import { PORTAL_BREADCRUMB_MAP, type PortalNavItem } from "./portalNav";
import type { PortalCrumb } from "./PortalBreadcrumbsBar";

export function usePortalBreadcrumbs(
  pathname: string,
  labels: Record<string, string>,
): PortalCrumb[] {
  return useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const crumbs: PortalCrumb[] = [];

    if (parts[0] === "portal") {
      crumbs.push({ label: "Inicio", href: "/portal" });

      if (parts.length >= 2) {
        const section = `/portal/${parts[1]}`;
        const sectionLabel = PORTAL_BREADCRUMB_MAP[section];
        if (sectionLabel) crumbs.push({ label: sectionLabel, href: section });
      }

      if (parts.length >= 3) {
        const idSeg = parts[2];
        crumbs.push({ label: labels[idSeg] ?? "Detalle", href: pathname });
      }
    }

    return crumbs;
  }, [pathname, labels]);
}

export type { PortalNavItem };
