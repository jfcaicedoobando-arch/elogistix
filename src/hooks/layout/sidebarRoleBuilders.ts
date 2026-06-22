import {
  SIDEBAR_DASHBOARD_ITEMS,
  SIDEBAR_GESTION_ITEMS,
  SIDEBAR_PROFIT_ITEMS,
  SIDEBAR_REPORTES_ITEMS,
  SIDEBAR_CRM_ITEMS,
  SIDEBAR_DIRECTORIO_ITEMS,
  SIDEBAR_SISTEMA_ITEMS,
  SIDEBAR_COSTEO_ITEMS,
  SIDEBAR_BANDEJAS_ITEMS,
} from "@/components/layout/sidebarItems";

export interface SidebarSection {
  label: string;
  items: typeof SIDEBAR_DASHBOARD_ITEMS;
}

export interface BuilderDeps {
  crmItems: typeof SIDEBAR_CRM_ITEMS;
  sistemaItems: typeof SIDEBAR_SISTEMA_ITEMS;
}

export type Builder = (deps: BuilderDeps) => SidebarSection[];

const filterBandejas = (urls: string[]) =>
  SIDEBAR_BANDEJAS_ITEMS.filter((it) => urls.includes(it.url));
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
  { label: "Gestión", items: filterGestion(["/cotizaciones", "/embarques", "/facturacion", "/proformas"]) },
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
  { label: "Compras", items: [...filterBandejas(["/cxp/por-capturar"]), ...filterGestion(["/cxp"]), ...filterDirectorio(["/proveedores"])] },
  { label: "Facturación", items: [...filterBandejas(["/facturacion/por-emitir"]), ...filterGestion(["/facturacion", "/proformas", "/cartera", "/comisiones"])] },
  { label: "Tesorería", items: filterGestion(["/tesoreria"]) },
  { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
  { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
  { label: "Directorio", items: filterDirectorio(["/clientes"]) },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda", "/bitacora"]) },
];

const buildTesorero: Builder = ({ sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Compras", items: [...filterBandejas(["/cxp/por-capturar", "/cxp/por-pagar"]), ...filterGestion(["/cxp"]), ...filterDirectorio(["/proveedores"])] },
  { label: "Tesorería", items: filterGestion(["/tesoreria"]) },
  { label: "Facturación", items: filterGestion(["/cartera", "/comisiones"]) },
  { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
  { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda", "/bitacora"]) },
];

const buildAuxiliarContable: Builder = ({ sistemaItems }) => [
  { label: "Compras", items: [...filterBandejas(["/cxp/por-capturar"]), ...filterGestion(["/cxp"]), ...filterDirectorio(["/proveedores"])] },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildEjecutivoCobranza: Builder = ({ sistemaItems }) => [
  {
    label: "Facturación",
    items: filterGestion(["/cartera", "/facturacion", "/proformas"]),
  },
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

export const buildAdmin: Builder = ({ crmItems, sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Gestión operativa", items: filterGestion(["/cotizaciones", "/embarques"]) },
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Compras", items: [...filterBandejas(["/cxp/por-capturar", "/cxp/por-pagar"]), ...filterGestion(["/cxp"]), ...filterDirectorio(["/proveedores"])] },
  { label: "Facturación", items: [...filterBandejas(["/facturacion/por-emitir"]), ...filterGestion(["/facturacion", "/proformas", "/cartera", "/comisiones"])] },
  { label: "Tesorería", items: filterGestion(["/tesoreria"]) },
  { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
  { label: "CRM", items: crmItems },
  { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
  { label: "Directorio", items: filterDirectorio(["/clientes"]) },
  { label: "Sistema", items: sistemaItems },
];

export const ROLE_BUILDERS: Record<string, Builder> = {
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
  admin: buildAdmin,
  admin_org: buildAdmin,
};

export function buildDefaultSections(deps: BuilderDeps): SidebarSection[] {
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
