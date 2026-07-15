/**
 * Sub-navegación horizontal del módulo Profit — Fase 4 UI/UX.
 *
 * Motivación: antes cada ruta (`/profit/dashboard`, `/profit/proyeccion`,
 * `/profit/estado-resultados`, `/profit/presupuesto`) era una isla. El usuario
 * final del módulo (Dirección / Finanzas) navega entre las 4 durante la
 * misma tarea — un CFO revisa Dashboard → Estado de Resultados → Presupuesto vs
 * Real sin regresar al sidebar. Este componente reemplaza esa fricción con
 * pills conectadas al `<PageHeader tabs>`.
 */
import { NavLink } from "react-router-dom";
import { LayoutDashboard, TrendingUp, FileBarChart, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/profit/dashboard", label: "Dashboard Ejecutivo", icon: LayoutDashboard },
  { to: "/profit/proyeccion", label: "Proyección", icon: TrendingUp },
  { to: "/profit/estado-resultados", label: "Estado de Resultados", icon: FileBarChart },
  { to: "/profit/presupuesto", label: "Presupuesto vs Real", icon: Target },
] as const;

export function ProfitSubNav() {
  return (
    <nav
      aria-label="Sub-navegación de Profit"
      className="flex flex-wrap items-center gap-1 border-b border-border/60 -mb-px"
    >
      {ITEMS.map((it) => {
        const Icon = it.icon;
        return (
          <NavLink
            key={it.to}
            to={it.to}
            end
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-sm",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{it.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
