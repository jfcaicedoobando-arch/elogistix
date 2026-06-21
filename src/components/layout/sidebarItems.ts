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

export const SIDEBAR_GESTION_ITEMS: SidebarItem[] = [
  { title: "Cotizaciones", url: "/cotizaciones", icon: ClipboardList },
  { title: "Embarques", url: "/embarques", icon: Ship },
  { title: "Facturación", url: "/facturacion", icon: FileText },
  { title: "Proformas", url: "/proformas", icon: FileText },
  { title: "Cobranza", url: "/cartera", icon: PiggyBank },
  { title: "Cuentas por Pagar", url: "/cxp", icon: Receipt },
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

export const SIDEBAR_DIRECTORIO_ITEMS: SidebarItem[] = [
  { title: "Clientes", url: "/clientes", icon: UserCheck },
  { title: "Proveedores", url: "/proveedores", icon: Truck },
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

// v13.54.0 — Bloque Q: bandejas por rol financiero.
export const SIDEBAR_BANDEJAS_ITEMS: SidebarItem[] = [
  { title: "Por capturar (CxP)", url: "/cxp/por-capturar", icon: Receipt },
  { title: "Por pagar (CxP)", url: "/cxp/por-pagar", icon: Landmark },
  { title: "Por emitir (Facturación)", url: "/facturacion/por-emitir", icon: FileText },
  { title: "Cartera", url: "/cartera", icon: PiggyBank },
];
