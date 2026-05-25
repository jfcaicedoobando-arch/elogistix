import { useAuth } from "@/contexts/AuthContext";
import { useAuditoriaCount } from "@/hooks/auditoria";
import { useAlertasPendingCount } from "@/hooks/admin";
import {
  SIDEBAR_DASHBOARD_ITEMS,
  SIDEBAR_GESTION_ITEMS,
  SIDEBAR_REPORTES_ITEMS,
  SIDEBAR_CRM_ITEMS,
  SIDEBAR_DIRECTORIO_ITEMS,
  SIDEBAR_SISTEMA_ITEMS,
  SIDEBAR_ADMIN_ITEMS,
  SIDEBAR_SUPER_ADMIN_ITEMS,
} from "@/components/layout/sidebarItems";

export interface SidebarSection {
  label: string;
  items: typeof SIDEBAR_DASHBOARD_ITEMS;
}

export function useAppSidebarSections(): SidebarSection[] {
  const { role, effectiveRole } = useAuth();
  const { data: auditoriaCount = 0 } = useAuditoriaCount();
  const { count: alertasSistemaCount } = useAlertasPendingCount();

  const sistemaItems = SIDEBAR_SISTEMA_ITEMS.map((it) =>
    it.url === "/auditoria" ? { ...it, badgeCount: auditoriaCount } : it,
  );
  const superAdminItems = SIDEBAR_SUPER_ADMIN_ITEMS.map((it) =>
    it.url === "/admin" ? { ...it, badgeCount: alertasSistemaCount } : it,
  );

  // El rol "vendedor" tiene una vista enfocada: sólo CRM + Directorio (clientes) + ayuda.
  if (effectiveRole === "vendedor") {
    return [
      { label: "CRM", items: SIDEBAR_CRM_ITEMS },
      { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS.filter((it) => it.url === "/clientes") },
      { label: "Sistema", items: sistemaItems.filter((it) => it.url === "/ayuda" || it.url === "/changelog") },
    ];
  }

  const sections: SidebarSection[] = [
    { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
    { label: "Gestión", items: SIDEBAR_GESTION_ITEMS },
    { label: "CRM", items: SIDEBAR_CRM_ITEMS },
    { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
    { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
    { label: "Sistema", items: sistemaItems },
  ];
  if (effectiveRole === "admin" || role === "super_admin") {
    sections.push({ label: "Administración", items: SIDEBAR_ADMIN_ITEMS });
  }
  if (role === "super_admin") {
    sections.push({ label: "Super Admin", items: superAdminItems });
  }
  return sections;
}
