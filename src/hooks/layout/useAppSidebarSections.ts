import { useAuth } from "@/lib/contexts/AuthContext";
import { useAuditoriaCount } from "@/features/auditoria/hooks";
import { useAlertasPendingCount } from "@/features/admin/hooks";
import { useActividadesVencidasCount } from "@/features/crm/hooks/useCrmDashboard";
import { useSidebarAlerts } from "@/hooks/layout/useSidebarAlerts";
import { useCxpPendientesAprobacion } from "@/features/cxp/hooks/useCxpPendientesAprobacion";
import { useCxpPorPagarCount } from "@/features/cxp/hooks/useCxpPorPagarCount";
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
  filterSectionsByRole,
  type BuilderDeps,
  type SidebarSection,
} from "@/hooks/layout/sidebarRoleBuilders";

export type { SidebarSection } from "@/hooks/layout/sidebarRoleBuilders";

interface BadgeCounts {
  embarquesAlertas: number;
  facturasVencidas: number;
  cxpPorAprobar: number;
  cxpPorPagar: number;
}

function patchSidebarBadges(sections: SidebarSection[], counts: BadgeCounts): SidebarSection[] {
  const { embarquesAlertas, facturasVencidas, cxpPorAprobar, cxpPorPagar } = counts;
  if (embarquesAlertas <= 0 && facturasVencidas <= 0 && cxpPorAprobar <= 0 && cxpPorPagar <= 0) return sections;
  return sections.map((sec) => ({
    ...sec,
    items: sec.items.map((it) => {
      if (it.url === "/embarques" && embarquesAlertas > 0) return { ...it, badgeCount: embarquesAlertas };
      if (it.url === "/facturacion" && facturasVencidas > 0) return { ...it, badgeCount: facturasVencidas };
      if (it.url === "/compras/por-aprobar" && cxpPorAprobar > 0) return { ...it, badgeCount: cxpPorAprobar };
      if (it.url === "/compras/por-pagar" && cxpPorPagar > 0) return { ...it, badgeCount: cxpPorPagar };
      return it;
    }),
  }));
}

export function useAppSidebarSections(): SidebarSection[] {
  const { role, effectiveRole } = useAuth();
  const canVerAuditoria =
    role === "super_admin" || effectiveRole === "admin" || effectiveRole === "admin_org";
  const isAdmin = effectiveRole === "admin" || effectiveRole === "admin_org" || role === "super_admin";
  const { data: auditoriaCount = 0 } = useAuditoriaCount({ enabled: canVerAuditoria });
  const { count: alertasSistemaCount } = useAlertasPendingCount();
  const { data: crmVencidas = 0 } = useActividadesVencidasCount();
  const { embarquesDemora, facturasVencidas, garantiasAtoradas, adminPendientes } = useSidebarAlerts();
  const { data: cxpPorAprobar = 0 } = useCxpPendientesAprobacion();
  const { data: cxpPorPagar = 0 } = useCxpPorPagarCount();
  const embarquesAlertas = embarquesDemora + garantiasAtoradas + adminPendientes;
  const badgeCounts: BadgeCounts = { embarquesAlertas, facturasVencidas, cxpPorAprobar, cxpPorPagar };

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
  const sections = builder ? builder(deps) : isAdmin ? buildAdmin(deps) : buildDefaultSections(deps);
  if (isAdmin) sections.push({ label: "Administración", items: SIDEBAR_ADMIN_ITEMS });
  if (role === "super_admin") sections.push({ label: "Super Admin", items: superAdminItems });
  const accessible = filterSectionsByRole(sections, effectiveRole ?? role);
  return patchSidebarBadges(accessible, badgeCounts).filter((sec) => sec.items.length > 0);
}
