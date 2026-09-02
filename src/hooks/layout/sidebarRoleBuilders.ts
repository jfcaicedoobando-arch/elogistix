import { hasRouteAccess } from "@/lib/access/roleRouteMatrix";
import type { AppRole } from "@/types/appRole";
import {
  SIDEBAR_DASHBOARD_ITEMS,
  SIDEBAR_VENTAS_ITEMS,
  SIDEBAR_OPERACION_ITEMS,
  SIDEBAR_DINERO_ITEMS,
  SIDEBAR_ANALISIS_ITEMS,
  SIDEBAR_CRM_ITEMS,
  SIDEBAR_SISTEMA_ITEMS,
  SIDEBAR_COSTEO_ITEMS,
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

const filterVentas = (urls: string[]) =>
  SIDEBAR_VENTAS_ITEMS.filter((it) => urls.includes(it.url));
const filterOperacion = (urls: string[]) =>
  SIDEBAR_OPERACION_ITEMS.filter((it) => urls.includes(it.url));
const filterDinero = (urls: string[]) =>
  SIDEBAR_DINERO_ITEMS.filter((it) => urls.includes(it.url));
const filterAnalisis = (urls: string[]) =>
  SIDEBAR_ANALISIS_ITEMS.filter((it) => urls.includes(it.url));
const filterSistema = (sistemaItems: typeof SIDEBAR_SISTEMA_ITEMS, urls: string[]) =>
  sistemaItems.filter((it) => urls.includes(it.url));

/**
 * v13.175.0 — Filtra items del módulo Compras por rol. `full()` regresa todo;
 * en general los roles seleccionan un subconjunto por URL.
 */
const filterCompras = (urls: string[]) =>
  SIDEBAR_COMPRAS_ITEMS.filter((it) => urls.includes(it.url));
const COMPRAS_FULL = SIDEBAR_COMPRAS_ITEMS.map((it) => it.url);
const COMPRAS_READ_ONLY = ["/compras", "/compras/facturas", "/compras/proveedores", "/compras/aging"];

const COMPRAS_CAPTURA = ["/compras", "/compras/por-capturar", "/compras/buzon", "/compras/facturas", "/compras/proveedores"];
const COMPRAS_CONTADOR = ["/compras", "/compras/por-capturar", "/compras/buzon", "/compras/por-aprobar", "/compras/facturas", "/compras/anticipos", "/compras/notas-credito", "/compras/proveedores", "/compras/conciliacion", "/compras/aging", "/compras/reportes"];
const COMPRAS_TESORERO = ["/compras", "/compras/por-pagar", "/compras/facturas", "/compras/anticipos", "/compras/pagos", "/compras/proveedores", "/compras/conciliacion", "/compras/aging", "/compras/reportes"];

const DINERO_FULL = SIDEBAR_DINERO_ITEMS.map((it) => it.url);

const buildVendedor: Builder = ({ crmItems, sistemaItems }) => [
  { label: "Inicio", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Operación", items: [...filterOperacion(["/cotizaciones"]), ...crmItems] },
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Ventas (CxC)", items: filterVentas(["/clientes"]) },
  // v13.343.1 — El vendedor NO ve Profit: `PROFIT_READ_ROLES` no lo incluye y
  // el ítem quedaba muerto (clic → pantalla sin permiso).

  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildCustomerService: Builder = ({ sistemaItems }) => [
  { label: "Inicio", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Operación", items: filterOperacion(["/cotizaciones", "/embarques"]) },
  { label: "Ventas (CxC)", items: filterVentas(["/clientes"]) },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/auditoria", "/ayuda"]) },
];

const buildCoordinador: Builder = ({ sistemaItems }) => [
  { label: "Inicio", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Operación", items: filterOperacion(["/cotizaciones", "/embarques"]) },
  { label: "Ventas (CxC)", items: filterVentas(["/facturacion", "/proformas?estado=aceptada", "/proformas", "/clientes"]) },
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildEjecutivoPricing: Builder = ({ sistemaItems }) => [
  { label: "Inicio", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Operación", items: filterOperacion(["/cotizaciones"]) },
  { label: "Compras (CxP)", items: filterCompras(["/compras/proveedores"]) },
  { label: "Ventas (CxC)", items: filterVentas(["/clientes"]) },
  { label: "Análisis", items: filterAnalisis(["/reportes/cierre-mensual", "/reportes/rentabilidad"]) },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildContador: Builder = ({ sistemaItems }) => [
  { label: "Inicio", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Compras (CxP)", items: filterCompras(COMPRAS_CONTADOR) },
  { label: "Ventas (CxC)", items: filterVentas(["/facturacion", "/proformas?estado=aceptada", "/proformas", "/cobranza", "/comisiones", "/cobranza/aging", "/clientes"]) },
  { label: "Dinero", items: filterDinero(DINERO_FULL) },
  { label: "Operación", items: filterOperacion(["/embarques"]) },
  { label: "Análisis", items: SIDEBAR_ANALISIS_ITEMS },
  { label: "Sistema", items: [...filterSistema(sistemaItems, ["/ayuda", "/bitacora"]), ...SIDEBAR_ADMIN_ITEMS.filter((it) => it.url === "/configuracion")] },
];

const buildTesorero: Builder = ({ sistemaItems }) => [
  { label: "Inicio", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Compras (CxP)", items: filterCompras(COMPRAS_TESORERO) },
  { label: "Dinero", items: filterDinero(DINERO_FULL) },
  { label: "Ventas (CxC)", items: filterVentas(["/cobranza", "/comisiones", "/cobranza/aging"]) },
  { label: "Análisis", items: SIDEBAR_ANALISIS_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda", "/bitacora"]) },
];

const buildAuxiliarContable: Builder = ({ sistemaItems }) => [
  { label: "Compras (CxP)", items: filterCompras(COMPRAS_CAPTURA) },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildEjecutivoCobranza: Builder = ({ sistemaItems }) => [
  { label: "Ventas (CxC)", items: filterVentas(["/cobranza", "/facturacion", "/proformas?estado=aceptada", "/proformas", "/cobranza/aging", "/clientes"]) },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda"]) },
];

const buildGerenteComercial: Builder = ({ crmItems, sistemaItems }) => [
  { label: "Inicio", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Operación", items: [...filterOperacion(["/cotizaciones", "/embarques"]), ...crmItems] },
  // v13.369.1 — Estado de cuenta de clientes (cartera + antigüedad de saldos).
  { label: "Ventas (CxC)", items: filterVentas(["/cobranza", "/cobranza/aging", "/comisiones", "/clientes"]) },
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Análisis", items: SIDEBAR_ANALISIS_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda", "/bitacora"]) },
];


const buildGerenteOperaciones: Builder = ({ crmItems, sistemaItems }) => [
  { label: "Inicio", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Operación", items: [...filterOperacion(["/cotizaciones", "/embarques"]), ...crmItems] },
  { label: "Ventas (CxC)", items: filterVentas(["/facturacion", "/proformas?estado=aceptada", "/proformas", "/cobranza", "/comisiones", "/cobranza/aging", "/clientes"]) },
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Compras (CxP)", items: filterCompras(COMPRAS_READ_ONLY) },
  { label: "Dinero", items: SIDEBAR_DINERO_ITEMS },
  { label: "Análisis", items: SIDEBAR_ANALISIS_ITEMS },
  { label: "Sistema", items: filterSistema(sistemaItems, ["/ayuda", "/bitacora"]) },
];

export const buildAdmin: Builder = ({ crmItems, sistemaItems }) => [
  { label: "Inicio", items: SIDEBAR_DASHBOARD_ITEMS },
  { label: "Operación", items: [...filterOperacion(["/cotizaciones", "/embarques"]), ...crmItems] },
  { label: "Ventas (CxC)", items: filterVentas(["/facturacion", "/proformas?estado=aceptada", "/proformas", "/cobranza", "/comisiones", "/cobranza/aging", "/clientes"]) },
  { label: "Compras (CxP)", items: filterCompras(COMPRAS_FULL) },
  { label: "Dinero", items: SIDEBAR_DINERO_ITEMS },
  { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
  { label: "Análisis", items: SIDEBAR_ANALISIS_ITEMS },
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
    { label: "Inicio", items: SIDEBAR_DASHBOARD_ITEMS },
    { label: "Operación", items: [...filterOperacion(["/cotizaciones", "/embarques"]), ...deps.crmItems] },
    { label: "Ventas (CxC)", items: filterVentas(["/facturacion", "/proformas?estado=aceptada", "/proformas", "/cobranza", "/comisiones", "/cobranza/aging", "/clientes"]) },
    { label: "Compras (CxP)", items: filterCompras(COMPRAS_READ_ONLY) },
    { label: "Dinero", items: SIDEBAR_DINERO_ITEMS },
    { label: "Costeo", items: SIDEBAR_COSTEO_ITEMS },
    { label: "Análisis", items: SIDEBAR_ANALISIS_ITEMS },
    { label: "Sistema", items: filterSistema(deps.sistemaItems, ["/ayuda", "/bitacora"]) },
  ];
}

/**
 * Q-16 (2) — Filtra los ítems visibles de cada sección por la matriz
 * rol→ruta (`hasRouteAccess`), evitando que un builder liste manualmente
 * una URL a la que ese rol ya no tiene acceso (drift builder↔matriz).
 */
export function filterSectionsByRole(
  sections: SidebarSection[],
  role: AppRole | null | undefined,
): SidebarSection[] {
  return sections.map((sec) => ({
    ...sec,
    items: sec.items.filter((it) => hasRouteAccess(role, it.url)),
  }));
}
