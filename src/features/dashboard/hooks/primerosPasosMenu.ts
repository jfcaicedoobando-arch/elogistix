import type { AppRole } from "@/types/appRole";
import {
  ROLE_BUILDERS, buildAdmin, buildDefaultSections, filterSectionsByRole,
} from "@/hooks/layout/sidebarRoleBuilders";
import {
  SIDEBAR_ADMIN_ITEMS, SIDEBAR_CRM_ITEMS, SIDEBAR_SISTEMA_ITEMS, SIDEBAR_SUPER_ADMIN_ITEMS,
} from "@/components/layout/sidebarItems";

/** Mismo menú del ERP, sin ejecutar hooks de contadores ni consultar datos. */
export function resolverRutasVisiblesPrimerosPasos(
  role: AppRole | null, effectiveRole: AppRole | null,
): ReadonlySet<string> {
  if (!effectiveRole || role === "cliente" || role === "agente_carga") return new Set();
  const isAdmin = effectiveRole === "admin" || effectiveRole === "admin_org" || role === "super_admin";
  const deps = { crmItems: SIDEBAR_CRM_ITEMS, sistemaItems: SIDEBAR_SISTEMA_ITEMS };
  const builder = ROLE_BUILDERS[effectiveRole];
  const sections = builder ? builder(deps) : isAdmin ? buildAdmin(deps) : buildDefaultSections(deps);
  if (isAdmin) sections.push({ label: "Administración", items: SIDEBAR_ADMIN_ITEMS });
  if (role === "super_admin") sections.push({ label: "Super Admin", items: SIDEBAR_SUPER_ADMIN_ITEMS });
  return new Set(filterSectionsByRole(sections, effectiveRole).flatMap(
    (section) => section.items.map((item) => item.url.split("?")[0]),
  ));
}
