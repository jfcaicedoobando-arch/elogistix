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
  SIDEBAR_COMPRAS_ITEMS,
  SIDEBAR_ADMIN_ITEMS,
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

const filterGestion = (urls: string[]) =>
  SIDEBAR_GESTION_ITEMS.filter((it) => urls.includes(it.url));
const filterSistema = (sistemaItems: typeof SIDEBAR_SISTEMA_ITEMS, urls: string[]) =>
  sistemaItems.filter((it) => urls.includes(it.url));
const filterDirectorio = (urls: string[]) =>
  SIDEBAR_DIRECTORIO_ITEMS.filter((it) => urls.includes(it.url));

/**
 * v13.175.0 — Filtra items del módulo Compras por rol. `full()` regresa todo;
 * en general los roles seleccionan un subconjunto por URL.
 */
const filterCompras = (urls: string[]) =>
  SIDEBAR_COMPRAS_ITEMS.filter((it) => urls.includes(it.url));
const COMPRAS_FULL = SIDEBAR_COMPRAS_ITEMS.map((it) => it.url);
const COMPRAS_READ_ONLY = ["/compras", "/compras/facturas", "/compras/proveedores", "/compras/aging"];
const COMPRAS_CAPTURA = ["/compras", "/compras/por-capturar", "/compras/facturas", "/compras/proveedores"];
const COMPRAS_CONTADOR = ["/compras", "/compras/por-capturar", "/compras/por-aprobar", "/compras/facturas", "/compras/notas-credito", "/compras/proveedores", "/compras/conciliacion", "/compras/aging", "/compras/reportes"];
const COMPRAS_TESORERO = ["/compras", "/compras/por-pagar", "/compras/facturas", "/compras/pagos", "/compras/proveedores", "/compras/conciliacion", "/compras/aging", "/compras/reportes"];

const buildVendedor: Builder = ({ crmItems, sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "CRM", items: crmItems },
  { label: "Gestión", items: filterGestion(["/cotizaciones"]) },
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
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
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Gestión", items: filterGestion(["/cotizaciones"]) },
  { label: "Compras", items: filterCompras(["/compras/proveedores"]) },
  { label: "Directorio", items: filterDirectorio(["/clientes"]) },
  { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildContador: Builder = ({ sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  // v13.141.14 — contador con acceso de viewer al módulo de embarques
  { label: "Operaciones", items: filterGestion(["/embarques"]) },
  { label: "Compras", items: filterCompras(COMPRAS_CONTADOR) },
  { label: "Facturación", items: [...filterGestion(["/facturacion", "/proformas", "/cartera", "/comisiones", "/cobranza/aging"]), ...SIDEBAR_ADMIN_ITEMS.filter((it) => it.url === "/configuracion")] },
  { label: "Tesorería", items: filterGestion(["/tesoreria"]) },
  { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
  { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
  { label: "Directorio", items: filterDirectorio(["/clientes"]) },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda", "/bitacora"]) },
];

const buildTesorero: Builder = ({ sistemaItems }) => [
  { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Compras", items: filterCompras(COMPRAS_TESORERO) },
  { label: "Tesorería", items: filterGestion(["/tesoreria"]) },
  { label: "Facturación", items: filterGestion(["/cartera", "/comisiones", "/cobranza/aging"]) },
  { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
  { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda", "/bitacora"]) },
];

const buildAuxiliarContable: Builder = ({ sistemaItems }) => [
  { label: "Compras", items: filterCompras(COMPRAS_CAPTURA) },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildEjecutivoCobranza: Builder = ({ sistemaItems }) => [
  {
    label: "Facturación",
    items: filterGestion(["/cartera", "/facturacion", "/proformas", "/cobranza/aging"]),
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
  { label: "Compras", items: filterCompras(COMPRAS_READ_ONLY) },
  { label: "Bandejas", items: SIDEBAR_BANDEJAS_ITEMS },
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
  { label: "Compras", items: filterCompras(COMPRAS_FULL) },
  { label: "Facturación", items: filterGestion(["/facturacion", "/proformas", "/cartera", "/comisiones", "/cobranza/aging"]) },
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
    { label: "Compras", items: filterCompras(COMPRAS_READ_ONLY) },
    { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
    { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
    { label: "CRM", items: deps.crmItems },
    { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
    { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
    { label: "Sistema", items: deps.sistemaItems },
  ];
}
