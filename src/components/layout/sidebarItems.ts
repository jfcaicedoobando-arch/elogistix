import {
  LayoutDashboard,
  Ship,
  FileText,
  UserCheck,
  Truck,
  Activity,
  ClipboardList,
  ScrollText,
  ShieldCheck,
  Settings,
  BarChart3,
  Building2,
  ShieldAlert,
  Trash2,
  Repeat2,
  HelpCircle,
  Bug,
  Target,
  TrendingUp,
  PiggyBank,
  Receipt,
  Landmark,
  Percent,
  Calculator,
  Route,
  Users,
  Anchor,
  Search,
  Calendar,
  ShoppingCart,
  Inbox,
  ShieldCheck as ShieldApprove,
  LayoutList,
  ReceiptText,
  GitCompare,
} from "lucide-react";
import type { SidebarItem } from "@/components/layout/SidebarGroupBlock";

export const SIDEBAR_PROFIT_ITEMS: SidebarItem[] = [
  { title: "Dashboard Ejecutivo", url: "/profit/dashboard", icon: LayoutDashboard },
  { title: "Proyección", url: "/profit/proyeccion", icon: TrendingUp },
  { title: "Estado de Resultados", url: "/profit/estado-resultados", icon: PiggyBank },
  { title: "Presupuesto vs Real", url: "/profit/presupuesto", icon: BarChart3 },
];

export const SIDEBAR_DASHBOARD_ITEMS: SidebarItem[] = [
  { title: "Principal", url: "/", icon: LayoutDashboard },
  { title: "Operaciones", url: "/operaciones", icon: Activity },
];

// v13.175.0 — Se removieron "Facturas de proveedor" (`/cxp`) — ahora vive
// exclusivamente en la sección Compras como "Facturas" (`/compras/facturas`).
export const SIDEBAR_GESTION_ITEMS: SidebarItem[] = [
  { title: "Cotizaciones", url: "/cotizaciones", icon: ClipboardList },
  { title: "Embarques", url: "/embarques", icon: Ship },
  { title: "Facturación", url: "/facturacion", icon: FileText },
  { title: "Proformas", url: "/proformas", icon: FileText },
  { title: "Cobranza", url: "/cartera", icon: PiggyBank },
  { title: "Tesorería", url: "/tesoreria", icon: Landmark },
  { title: "Comisiones", url: "/comisiones", icon: Percent },
];

export const SIDEBAR_REPORTES_ITEMS: SidebarItem[] = [
  { title: "Cierre mensual", url: "/reportes/cierre-mensual", icon: Calendar },
  { title: "Rentabilidad", url: "/reportes/rentabilidad", icon: BarChart3 },
];

export const SIDEBAR_CRM_ITEMS: SidebarItem[] = [
  { title: "CRM", url: "/crm", icon: Target },
];

// v13.175.0 — Proveedores migra al módulo Compras (`/compras/proveedores`).
export const SIDEBAR_DIRECTORIO_ITEMS: SidebarItem[] = [
  { title: "Clientes", url: "/clientes", icon: UserCheck },
];

export const SIDEBAR_SISTEMA_ITEMS: SidebarItem[] = [
  { title: "Auditoría operativa", url: "/auditoria", icon: ShieldAlert },
  { title: "Bitácora", url: "/bitacora", icon: ScrollText },
  { title: "Sentry", url: "/sentry", icon: Bug },
  { title: "Ayuda", url: "/ayuda", icon: HelpCircle },
];

export const SIDEBAR_ADMIN_ITEMS: SidebarItem[] = [
  { title: "Usuarios", url: "/usuarios", icon: ShieldCheck },
  { title: "Papelera", url: "/papelera", icon: Trash2 },
  { title: "Idempotencia", url: "/idempotencia", icon: Repeat2 },
  { title: "Configuración", url: "/configuracion", icon: Settings },
];

export const SIDEBAR_SUPER_ADMIN_ITEMS: SidebarItem[] = [
  { title: "Panel Admin", url: "/admin", icon: Building2 },
];

export const SIDEBAR_COSTEO_ITEMS: SidebarItem[] = [
  { title: "Buscar tarifa", url: "/costeo/buscar", icon: Search },
  { title: "Tarifas marítimas", url: "/costeo/tarifas", icon: Calculator },
  { title: "Rutas CN → MX", url: "/costeo/rutas", icon: Route },
  { title: "Agentes", url: "/costeo/agentes", icon: Users },
 { title: "Navieras (Condiciones)", url: "/costeo/navieras", icon: Anchor },
 { title: "Tarifa demoras (venta)", url: "/costeo/demoras-venta", icon: Calculator },
];

// v13.175.0 — Cartera (CxC) es la única bandeja que no vive bajo /compras.
export const SIDEBAR_BANDEJAS_ITEMS: SidebarItem[] = [
  { title: "Cartera", url: "/cartera", icon: PiggyBank },
];

// v13.100.0 — Hub Compras. Deprecado como export standalone en v13.175.0.
// Se mantiene por compatibilidad hacia SIDEBAR_COMPRAS_ITEMS[0].
export const SIDEBAR_COMPRAS_HUB: SidebarItem = {
  title: "Dashboard", url: "/compras", icon: ShoppingCart,
};

/**
 * v13.175.0 — Módulo Compras unificado. Todas las rutas viven bajo `/compras/*`
 * y esta lista es la única fuente de verdad del sidebar para el módulo.
 * Cada builder de rol filtra por `url` los items que expone.
 */
export const SIDEBAR_COMPRAS_ITEMS: SidebarItem[] = [
  { title: "Dashboard", url: "/compras", icon: ShoppingCart },
  { title: "Por capturar", url: "/compras/por-capturar", icon: Inbox },
  { title: "Por aprobar", url: "/compras/por-aprobar", icon: ShieldApprove },
  { title: "Por pagar", url: "/compras/por-pagar", icon: Landmark },
  { title: "Facturas", url: "/compras/facturas", icon: Receipt },
  { title: "Pagos", url: "/compras/pagos", icon: Landmark },
  { title: "Notas de crédito", url: "/compras/notas-credito", icon: ReceiptText },
  { title: "Proveedores", url: "/compras/proveedores", icon: Truck },
  { title: "Antigüedad", url: "/compras/aging", icon: LayoutList },
  { title: "Reportes", url: "/compras/reportes", icon: BarChart3 },
];
