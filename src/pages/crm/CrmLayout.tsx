import { useState, useCallback, useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Target, Users, Activity, BarChart3, LayoutDashboard, Settings, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useActividadesVencidasCount } from "@/hooks/crm";
import { useCrmHotkeys } from "@/hooks/crm";
import { usePermissions } from "@/hooks/shared";
import QuickAddMenu from "@/components/crm/QuickAddMenu";
import CrmCommandPalette from "@/components/crm/CrmCommandPalette";

const TABS = [
  { to: "/crm/mi-dia", label: "Mi día", icon: Sun, end: false },
  { to: "/crm", label: "Resumen", icon: LayoutDashboard, end: true },
  { to: "/crm/leads", label: "Leads", icon: Users, end: false },
  { to: "/crm/oportunidades", label: "Oportunidades", icon: Target, end: false },
  { to: "/crm/actividades", label: "Actividades", icon: Activity, end: false },
  { to: "/crm/analitica", label: "Analítica", icon: BarChart3, end: false },
];

export default function CrmLayout() {
  const { data: vencidas = 0 } = useActividadesVencidasCount();
  const { canEditCrm, canEdit } = usePermissions();
  const [openTrigger, setOpenTrigger] = useState(0);
  const [dialogTrigger, setDialogTrigger] = useState<{ kind: "lead" | "oportunidad" | "actividad"; n: number } | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const noop = useCallback(() => {}, []);
  const handlers = useMemo(
    () => ({
      onOpenQuick: canEdit ? () => setOpenTrigger((n) => n + 1) : noop,
      onNewLead: canEdit ? () => setDialogTrigger((p) => ({ kind: "lead" as const, n: (p?.n ?? 0) + 1 })) : noop,
      onNewOportunidad: canEdit ? () => setDialogTrigger((p) => ({ kind: "oportunidad" as const, n: (p?.n ?? 0) + 1 })) : noop,
      onNewActividad: canEdit ? () => setDialogTrigger((p) => ({ kind: "actividad" as const, n: (p?.n ?? 0) + 1 })) : noop,
      onOpenPalette: () => setPaletteOpen(true),
    }),
    [canEdit, noop],
  );
  useCrmHotkeys(handlers);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background">
        <nav className="px-6 flex items-center gap-1 overflow-x-auto h-12">
          {TABS.map((t) => {
            const showBadge = t.to === "/crm/actividades" && vencidas > 0;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 px-3 h-12 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
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
          <div className="ml-auto flex items-center gap-2">
            {canEdit && <QuickAddMenu openTrigger={openTrigger} dialogTrigger={dialogTrigger} />}
            {canEditCrm && (
              <NavLink
                to="/crm/configuracion"
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center justify-center w-9 h-9 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )
                }
                title="Configuración del CRM"
                aria-label="Configuración"
              >
                <Settings className="h-4 w-4" />
              </NavLink>
            )}
          </div>
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
      <CrmCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
