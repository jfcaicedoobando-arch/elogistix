/**
 * Grupos de navegación del panel Super Admin.
 *
 * Viven fuera de `AdminSidebar.tsx` para no romper Fast Refresh (un archivo de
 * componentes no debe exportar además constantes) — v13.343.1.
 */
import {
  LayoutDashboard,
  Building2,
  Settings,
  Activity,
  ShieldCheck,
  Users2,
} from "lucide-react";

export interface AdminSidebarItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
}

export interface AdminSidebarGroup {
  label: string;
  items: AdminSidebarItem[];
}

export const adminGroups: AdminSidebarGroup[] = [
  {
    label: "Plataforma",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Organizaciones", url: "/admin/organizaciones", icon: Building2 },
      { title: "Auditoría plataforma", url: "/admin/auditoria", icon: ShieldCheck },
      { title: "Leads demo", url: "/admin/demo-leads", icon: Users2 },
      { title: "Diagnóstico", url: "/admin/diagnostico", icon: Activity },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configuración Global", url: "/admin/configuracion", icon: Settings },
    ],
  },
];
