import { NavLink, Outlet } from "react-router-dom";
import { Target, Users, Activity, BarChart3, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useActividadesVencidasCount } from "@/hooks/crm";
import { usePermissions } from "@/hooks/shared";
import QuickAddMenu from "@/components/crm/QuickAddMenu";

const TABS = [
  { to: "/crm", label: "Inicio", icon: LayoutDashboard, end: true },
  { to: "/crm/leads", label: "Leads", icon: Users, end: false },
  { to: "/crm/oportunidades", label: "Oportunidades", icon: Target, end: false },
  { to: "/crm/actividades", label: "Actividades", icon: Activity, end: false },
  { to: "/crm/analitica", label: "Analítica", icon: BarChart3, end: false },
];

export default function CrmLayout() {
  const { data: vencidas = 0 } = useActividadesVencidasCount();
  const { canEditCrm, canEdit } = usePermissions();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background">
        <div className="px-6 pt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
            <p className="text-sm text-muted-foreground">
              Gestión comercial: leads, oportunidades, actividades y analítica.
            </p>
          </div>
          {canEdit && <QuickAddMenu />}
        </div>
        <nav className="px-6 mt-3 flex gap-1 overflow-x-auto items-center">
          {TABS.map((t) => {
            const showBadge = t.to === "/crm/actividades" && vencidas > 0;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
                  )
                }
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {showBadge && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px] font-bold rounded-full">
                    {vencidas > 99 ? "99+" : vencidas}
                  </Badge>
                )}
              </NavLink>
            );
          })}
          {canEditCrm && (
            <NavLink
              to="/crm/configuracion"
              className={({ isActive }) =>
                cn(
                  "ml-auto inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
                )
              }
              title="Configuración del CRM"
              aria-label="Configuración"
            >
              <Settings className="h-4 w-4" />
            </NavLink>
          )}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
