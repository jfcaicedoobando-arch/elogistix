import { useAuth } from "@/lib/contexts/AuthContext";
import { useAuditoriaCount } from "@/features/auditoria/hooks";
import { useAlertasPendingCount } from "@/features/admin/hooks";
import { useActividadesVencidasCount } from "@/features/crm/hooks/useCrmDashboard";
import { useSidebarAlerts } from "@/hooks/layout/useSidebarAlerts";
import {
  SIDEBAR_CRM_ITEMS,
  SIDEBAR_SISTEMA_ITEMS,
  SIDEBAR_ADMIN_ITEMS,
  SIDEBAR_SUPER_ADMIN_ITEMS,
} from "@/components/layout/sidebarItems";
import {
  ROLE_BUILDERS,
  buildAdmin,
  buildDefaultSections,
  type BuilderDeps,
  type SidebarSection,
} from "@/hooks/layout/sidebarRoleBuilders";

export type { SidebarSection } from "@/hooks/layout/sidebarRoleBuilders";

function patchEmbarquesBadge(sections: SidebarSection[], adminPendientes: number): SidebarSection[] {
  if (adminPendientes <= 0) return sections;
  return sections.map((sec) => ({
    ...sec,
    items: sec.items.map((it) =>
      it.url === "/embarques" ? { ...it, badgeCount: adminPendientes } : it,
    ),
  }));
}

export function useAppSidebarSections(): SidebarSection[] {
  const { role, effectiveRole } = useAuth();
  const canVerAuditoria =
    role === "super_admin" || effectiveRole === "admin" || effectiveRole === "admin_org";
  const { data: auditoriaCount = 0 } = useAuditoriaCount({ enabled: canVerAuditoria });
  const { count: alertasSistemaCount } = useAlertasPendingCount();
  const { data: crmVencidas = 0 } = useActividadesVencidasCount();
  const { adminPendientes } = useSidebarAlerts();

  const sistemaItems = SIDEBAR_SISTEMA_ITEMS.map((it) =>
    it.url === "/auditoria" ? { ...it, badgeCount: auditoriaCount } : it,
  );
  const superAdminItems = SIDEBAR_SUPER_ADMIN_ITEMS.map((it) =>
    it.url === "/admin" ? { ...it, badgeCount: alertasSistemaCount } : it,
  );
  const crmItems = SIDEBAR_CRM_ITEMS.map((it) =>
    it.url === "/crm" ? { ...it, badgeCount: crmVencidas } : it,
  );

  const deps: BuilderDeps = { crmItems, sistemaItems };
  const builder = effectiveRole ? ROLE_BUILDERS[effectiveRole] : undefined;
  if (builder) return patchEmbarquesBadge(builder(deps), adminPendientes);

  const isAdmin = effectiveRole === "admin" || effectiveRole === "admin_org" || role === "super_admin";
  const sections = isAdmin ? buildAdmin(deps) : buildDefaultSections(deps);
  if (isAdmin) sections.push({ label: "Administración", items: SIDEBAR_ADMIN_ITEMS });
  if (role === "super_admin") sections.push({ label: "Super Admin", items: superAdminItems });
  return patchEmbarquesBadge(sections, adminPendientes);
}
