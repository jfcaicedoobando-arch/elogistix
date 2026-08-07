import {
  LayoutDashboard,
  Ship,
  FileSpreadsheet,
  Truck,
  Workflow,
  ClipboardList,
  ClipboardCheck,
  ScrollText,
  Settings,
  BarChart3,
  Building2,
  ShieldAlert,
  Trash2,
  Repeat2,
  HelpCircle,
  Bug,
  Handshake,
  TrendingUp,

  Receipt,
  Landmark,
  Percent,
  Calculator,
  Timer,
  Route,
  Users,
  Anchor,
  Search,
  Calendar,
  ShoppingCart,
  Inbox,
  LayoutList,
  ReceiptText,
  GitCompare,
  HandCoins,
  FileClock,
  Banknote,
  ArrowRightLeft,
  CalendarCheck,
  Wallet,
  FileText,

} from "lucide-react";
import type { SidebarItem } from "@/components/layout/SidebarGroupBlock";

export const SIDEBAR_DASHBOARD_ITEMS: SidebarItem[] = [
  { title: "Principal", url: "/", icon: LayoutDashboard },
  { title: "Operaciones", url: "/operaciones", icon: Workflow },
];

// v13.318.0 — Sidebar Etapa 2: reagrupación por flujo del dinero.
// Antes: SIDEBAR_GESTION_ITEMS / SIDEBAR_DIRECTORIO_ITEMS / SIDEBAR_PROFIT_ITEMS
// / SIDEBAR_REPORTES_ITEMS. Ahora se dividen en Ventas / Operación / Dinero / Análisis.
export const SIDEBAR_VENTAS_ITEMS: SidebarItem[] = [
  { title: "Facturación", url: "/facturacion", icon: Receipt },
  { title: "Por emitir", url: "/proformas?estado=aceptada", icon: FileClock },
  { title: "Proformas", url: "/proformas", icon: FileSpreadsheet },
  { title: "Cobranza", url: "/cartera", icon: HandCoins },
  { title: "Antigüedad CxC", url: "/cobranza/aging", icon: LayoutList },
  { title: "Comisiones", url: "/comisiones", icon: Percent },
  { title: "Clientes", url: "/clientes", icon: Building2 },
];

export const SIDEBAR_OPERACION_ITEMS: SidebarItem[] = [
  { title: "Cotizaciones", url: "/cotizaciones", icon: ClipboardList },
  { title: "Embarques", url: "/embarques", icon: Ship },
];

export const SIDEBAR_DINERO_ITEMS: SidebarItem[] = [
  { title: "Tesorería", url: "/tesoreria", icon: Landmark },
  { title: "Pagos programados", url: "/tesoreria/pagos-programados", icon: CalendarCheck },
  { title: "Conciliación bancaria", url: "/tesoreria/conciliacion", icon: GitCompare },
  { title: "Cuentas bancarias", url: "/tesoreria/cuentas", icon: Wallet },
  { title: "Estado de cuenta", url: "/tesoreria/estado-cuenta", icon: FileText },

  { title: "Flujo proyectado", url: "/tesoreria/flujo", icon: TrendingUp },
];

export const SIDEBAR_ANALISIS_ITEMS: SidebarItem[] = [
  { title: "Profit", url: "/profit", icon: TrendingUp },
  { title: "Cierre mensual", url: "/reportes/cierre-mensual", icon: Calendar },
  { title: "Rentabilidad", url: "/reportes/rentabilidad", icon: BarChart3 },
];

export const SIDEBAR_CRM_ITEMS: SidebarItem[] = [
  { title: "CRM", url: "/crm", icon: Handshake },
];

export const SIDEBAR_SISTEMA_ITEMS: SidebarItem[] = [
  { title: "Auditoría operativa", url: "/auditoria", icon: ShieldAlert },
  { title: "Bitácora", url: "/bitacora", icon: ScrollText },
  { title: "Sentry", url: "/sentry", icon: Bug },
  { title: "Ayuda", url: "/ayuda", icon: HelpCircle },
];

export const SIDEBAR_ADMIN_ITEMS: SidebarItem[] = [
  { title: "Usuarios", url: "/usuarios", icon: Users },
  { title: "Papelera", url: "/papelera", icon: Trash2 },
  { title: "Idempotencia", url: "/idempotencia", icon: Repeat2 },
  { title: "Configuración", url: "/configuracion", icon: Settings },
];

export const SIDEBAR_SUPER_ADMIN_ITEMS: SidebarItem[] = [
  { title: "Panel Admin", url: "/admin", icon: Building2 },
];

export const SIDEBAR_COSTEO_ITEMS: SidebarItem[] = [
  { title: "Comparador Top 3", url: "/costeo/buscar", icon: Search },
  { title: "Catálogo de tarifas", url: "/costeo/tarifas", icon: Calculator },
  { title: "Rutas CN → MX", url: "/costeo/rutas", icon: Route },
  { title: "Agentes", url: "/costeo/agentes", icon: Users },
  { title: "Navieras (Condiciones)", url: "/costeo/navieras", icon: Anchor },
  { title: "Tarifa demoras (venta)", url: "/costeo/demoras-venta", icon: Timer },
];

/**
 * v13.175.0 — Módulo Compras unificado. Todas las rutas viven bajo `/compras/*`
 * y esta lista es la única fuente de verdad del sidebar para el módulo.
 * Cada builder de rol filtra por `url` los items que expone.
 */
export const SIDEBAR_COMPRAS_ITEMS: SidebarItem[] = [
  { title: "Dashboard", url: "/compras", icon: ShoppingCart },
  { title: "Por capturar", url: "/compras/por-capturar", icon: Inbox },
  { title: "Buzón de facturas", url: "/compras/buzon", icon: Inbox },
  { title: "Por aprobar", url: "/compras/por-aprobar", icon: ClipboardCheck },
  { title: "Por pagar", url: "/compras/por-pagar", icon: Banknote },
  { title: "Facturas", url: "/compras/facturas", icon: Receipt },
  { title: "Anticipos", url: "/compras/anticipos", icon: HandCoins },
  { title: "Pagos", url: "/compras/pagos", icon: ArrowRightLeft },
  { title: "Notas de crédito", url: "/compras/notas-credito", icon: ReceiptText },
  { title: "Proveedores", url: "/compras/proveedores", icon: Truck },
  { title: "Conciliación CxP", url: "/compras/conciliacion", icon: GitCompare },
  { title: "Antigüedad CxP", url: "/compras/aging", icon: LayoutList },
  { title: "Reportes", url: "/compras/reportes", icon: BarChart3 },
];

/**
 * v13.319.0 — Sidebar Etapa 3 · 3.B: mapa aplanado `url → title` de todas las
 * constantes SIDEBAR_*_ITEMS de este archivo. Se usa para filtrar los
 * "Recientes" del GlobalSearch de modo que jamás entren detalles
 * (`/facturacion/:id`, portal, login, etc.) — sólo páginas del propio menú.
 */
const ALL_SIDEBAR_GROUPS: SidebarItem[][] = [
  SIDEBAR_DASHBOARD_ITEMS,
  SIDEBAR_VENTAS_ITEMS,
  SIDEBAR_OPERACION_ITEMS,
  SIDEBAR_DINERO_ITEMS,
  SIDEBAR_ANALISIS_ITEMS,
  SIDEBAR_CRM_ITEMS,
  SIDEBAR_SISTEMA_ITEMS,
  SIDEBAR_ADMIN_ITEMS,
  SIDEBAR_SUPER_ADMIN_ITEMS,
  SIDEBAR_COSTEO_ITEMS,
  SIDEBAR_COMPRAS_ITEMS,
];

export const SIDEBAR_URL_TITLE_MAP: Readonly<Record<string, string>> = Object.freeze(
  ALL_SIDEBAR_GROUPS.reduce<Record<string, string>>((acc, group) => {
    for (const item of group) {
      if (!(item.url in acc)) acc[item.url] = item.title;
    }
    return acc;
  }, {}),
);
