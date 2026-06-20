import { useAuth } from "@/lib/contexts/AuthContext";
import { useAuditoriaCount } from "@/features/auditoria/hooks";
import { useAlertasPendingCount } from "@/features/admin/hooks";
import { useActividadesVencidasCount } from "@/features/crm/hooks/useCrmDashboard";
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
  SIDEBAR_BANDEJAS_ITEMS,
} from "@/components/layout/sidebarItems";

const filterBandejas = (urls: string[]) =>
  SIDEBAR_BANDEJAS_ITEMS.filter((it) => urls.includes(it.url));

export interface SidebarSection {
  label: string;
  items: typeof SIDEBAR_DASHBOARD_ITEMS;
}

interface BuilderDeps {
  crmItems: typeof SIDEBAR_CRM_ITEMS;
  sistemaItems: typeof SIDEBAR_SISTEMA_ITEMS;
}

type Builder = (deps: BuilderDeps) => SidebarSection[];

const filterGestion = (urls: string[]) =>
  SIDEBAR_GESTION_ITEMS.filter((it) => urls.includes(it.url));
const filterSistema = (sistemaItems: typeof SIDEBAR_SISTEMA_ITEMS, urls: string[]) =>
  sistemaItems.filter((it) => urls.includes(it.url));
const filterDirectorio = (urls: string[]) =>
  SIDEBAR_DIRECTORIO_ITEMS.filter((it) => urls.includes(it.url));

const buildVendedor: Builder = ({ crmItems, sistemaItems }) => [
  { label: "CRM", items: crmItems },
  { label: "Directorio", items: filterDirectorio(["/clientes"]) },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildCustomerService: Builder = ({ sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Gestión", items: filterGestion(["/cotizaciones", "/embarques"]) },
  { label: "Directorio", items: filterDirectorio(["/clientes"]) },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/auditoria", "/ayuda"]) },
];

const buildCoordinador: Builder = ({ sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Gestión", items: filterGestion(["/cotizaciones", "/embarques", "/facturacion"]) },
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildEjecutivoPricing: Builder = ({ sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Gestión", items: filterGestion(["/cotizaciones", "/embarques"]) },
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
  { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildContador: Builder = ({ sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Mi bandeja", items: filterBandejas(["/facturacion/por-emitir", "/cartera"]) },
  { label: "Gestión", items: filterGestion(["/facturacion", "/cxp", "/tesoreria", "/comisiones"]) },
  { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
  { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
  { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda", "/bitacora"]) },
];

const buildTesorero: Builder = ({ sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Mi bandeja", items: filterBandejas(["/cxp/por-pagar"]) },
  { label: "Gestión", items: filterGestion(["/cxp", "/tesoreria", "/comisiones"]) },
  { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
  { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
  { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda", "/bitacora"]) },
];

const buildAuxiliarContable: Builder = ({ sistemaItems }) => [
  { label: "Mi bandeja", items: filterBandejas(["/cxp/por-capturar"]) },
  { label: "Gestión", items: filterGestion(["/cxp"]) },
  { label: "Directorio", items: filterDirectorio(["/proveedores"]) },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildEjecutivoCobranza: Builder = ({ sistemaItems }) => [
  { label: "Mi bandeja", items: filterBandejas(["/cartera"]) },
  { label: "Gestión", items: filterGestion(["/facturacion"]) },
  { label: "Directorio", items: filterDirectorio(["/clientes"]) },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildGerenteComercial: Builder = ({ crmItems, sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Gestión", items: filterGestion(["/cotizaciones", "/embarques", "/comisiones"]) },
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
  { label: "CRM", items: crmItems },
  { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
  { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda", "/bitacora"]) },
];

const buildGerenteOperaciones: Builder = ({ crmItems, sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Gestión", items: SIDEBAR_GESTION_ITEMS },
  { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
  { label: "CRM", items: crmItems },
  { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
  { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
  { label: "Sistema", items: sistemaItems.filter((it) => it.url !== "/auditoria") },
];

const ROLE_BUILDERS: Record<string, Builder> = {
  vendedor: buildVendedor,
  customer_service: buildCustomerService,
  viewer: buildCustomerService,
  operador: buildCoordinador,
  coordinador_logistico: buildCoordinador,
  ejecutivo_pricing: buildEjecutivoPricing,
  contador: buildContador,
  tesorero: buildTesorero,
  auxiliar_contable: buildAuxiliarContable,
  ejecutivo_cobranza: buildEjecutivoCobranza,
  gerente_comercial: buildGerenteComercial,
  gerente_operaciones: buildGerenteOperaciones,
};

function buildDefaultSections(deps: BuilderDeps): SidebarSection[] {
  return [
    { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
    { label: "Gestión", items: SIDEBAR_GESTION_ITEMS },
    { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
    { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
    { label: "CRM", items: deps.crmItems },
    { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
    { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
    { label: "Sistema", items: deps.sistemaItems },
  ];
}

export function useAppSidebarSections(): SidebarSection[] {
  const { role, effectiveRole } = useAuth();
  const canVerAuditoria =
    role === "super_admin" || effectiveRole === "admin" || effectiveRole === "admin_org";
  const { data: auditoriaCount = 0 } = useAuditoriaCount({ enabled: canVerAuditoria });
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

  const deps: BuilderDeps = { crmItems, sistemaItems };
  const builder = effectiveRole ? ROLE_BUILDERS[effectiveRole] : undefined;
  if (builder) return builder(deps);

  const sections = buildDefaultSections(deps);
  const isAdmin = effectiveRole === "admin" || effectiveRole === "admin_org" || role === "super_admin";
  if (isAdmin) sections.push({ label: "Administración", items: SIDEBAR_ADMIN_ITEMS });
  if (role === "super_admin") sections.push({ label: "Super Admin", items: superAdminItems });
  return sections;
}
