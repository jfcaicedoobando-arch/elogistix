import { useAuth } from "@/contexts/AuthContext";
import { useAuditoriaCount } from "@/features/auditoria/hooks";
import { useAlertasPendingCount } from "@/hooks/admin";
import { useActividadesVencidasCount } from "@/hooks/crm/useCrmDashboard";
import {
  SIDEBAR_DASHBOARD_ITEMS,
  SIDEBAR_GESTION_ITEMS,
  SIDEBAR_PROFIT_ITEMS,
  SIDEBAR_REPORTES_ITEMS,
  SIDEBAR_CRM_ITEMS,
  SIDEBAR_DIRECTORIO_ITEMS,
  SIDEBAR_SISTEMA_ITEMS,
  SIDEBAR_ADMIN_ITEMS,
  SIDEBAR_SUPER_ADMIN_ITEMS,
  SIDEBAR_COSTEO_ITEMS,
} from "@/components/layout/sidebarItems";

export interface SidebarSection {
  label: string;
  items: typeof SIDEBAR_DASHBOARD_ITEMS;
}

export function useAppSidebarSections(): SidebarSection[] {
  const { role, effectiveRole } = useAuth();
  const { data: auditoriaCount = 0 } = useAuditoriaCount();
  const { count: alertasSistemaCount } = useAlertasPendingCount();
  const { data: crmVencidas = 0 } = useActividadesVencidasCount();

  const sistemaItems = SIDEBAR_SISTEMA_ITEMS.map((it) =>
    it.url === "/auditoria" ? { ...it, badgeCount: auditoriaCount } : it,
  );
  const superAdminItems = SIDEBAR_SUPER_ADMIN_ITEMS.map((it) =>
    it.url === "/admin" ? { ...it, badgeCount: alertasSistemaCount } : it,
  );
  const crmItems = SIDEBAR_CRM_ITEMS.map((it) =>
    it.url === "/crm" ? { ...it, badgeCount: crmVencidas } : it,
  );

  // El rol "vendedor" tiene una vista enfocada: sólo CRM + Directorio (clientes) + ayuda.
  if (effectiveRole === "vendedor") {
    return [
      { label: "CRM", items: crmItems },
      { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS.filter((it) => it.url === "/clientes") },
      { label: "Sistema", items: sistemaItems.filter((it) => it.url === "/ayuda") },
    ];
  }

  // Atención a clientes (antes "viewer"): solo lectura operativa.
  if (effectiveRole === "customer_service" || effectiveRole === "viewer") {
    const gestionCS = SIDEBAR_GESTION_ITEMS.filter((it) =>
      ["/cotizaciones", "/embarques"].includes(it.url),
    );
    return [
      { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
      { label: "Gestión", items: gestionCS },
      { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS.filter((it) => it.url === "/clientes") },
      { label: "Sistema", items: sistemaItems.filter((it) => it.url === "/ayuda") },
    ];
  }

  // Coordinador logístico (antes "operador"): operación diaria sin finanzas.
  if (effectiveRole === "operador" || effectiveRole === "coordinador_logistico") {
    const gestionOperador = SIDEBAR_GESTION_ITEMS.filter((it) =>
      ["/cotizaciones", "/embarques", "/facturacion"].includes(it.url),
    );
    return [
      { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
      { label: "Gestión", items: gestionOperador },
      { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
      { label: "Sistema", items: sistemaItems.filter((it) => it.url === "/ayuda") },
    ];
  }

  // Ejecutivo de pricing: cotizaciones, embarques (lectura), reportes y directorio.
  if (effectiveRole === "ejecutivo_pricing") {
    const gestionPricing = SIDEBAR_GESTION_ITEMS.filter((it) =>
      ["/cotizaciones", "/embarques"].includes(it.url),
    );
    return [
      { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
      { label: "Gestión", items: gestionPricing },
      { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
      { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
      { label: "Sistema", items: sistemaItems.filter((it) => it.url === "/ayuda") },
    ];
  }

  // Contador / Tesorero: foco financiero. Sin CRM ni edición operativa.
  if (effectiveRole === "contador" || effectiveRole === "tesorero") {
    const gestionFin = SIDEBAR_GESTION_ITEMS.filter((it) =>
      effectiveRole === "tesorero"
        ? ["/cxp", "/tesoreria", "/comisiones"].includes(it.url)
        : ["/facturacion", "/cxp", "/tesoreria", "/comisiones"].includes(it.url),
    );
    return [
      { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
      { label: "Gestión", items: gestionFin },
      { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
      { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
      { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
      { label: "Sistema", items: sistemaItems.filter((it) => ["/ayuda", "/bitacora"].includes(it.url)) },
    ];
  }

  // Gerente de operaciones: todo lectura + edición operativa, sin admin.
  if (effectiveRole === "gerente_operaciones") {
    return [
      { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
      { label: "Gestión", items: SIDEBAR_GESTION_ITEMS },
      { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
      { label: "CRM", items: crmItems },
      { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
      { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
      { label: "Sistema", items: sistemaItems },
    ];
  }

  const sections: SidebarSection[] = [
    { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
    { label: "Gestión", items: SIDEBAR_GESTION_ITEMS },
    { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
    { label: "CRM", items: crmItems },
    { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
    { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
    { label: "Sistema", items: sistemaItems },
  ];
  if (effectiveRole === "admin" || effectiveRole === "admin_org" || role === "super_admin") {
    sections.push({ label: "Administración", items: SIDEBAR_ADMIN_ITEMS });
  }
  if (role === "super_admin") {
    sections.push({ label: "Super Admin", items: superAdminItems });
  }
  return sections;
}
