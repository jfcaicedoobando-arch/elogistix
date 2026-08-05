import { useState, useCallback, useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Target, Users, Activity, BarChart3, LayoutDashboard, Settings, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useActividadesVencidasCount } from "@/features/crm/hooks";
import { useCrmHotkeys } from "@/features/crm/hooks";
import { usePermissions } from "@/hooks/shared";
import QuickAddMenu from "@/features/crm/components/QuickAddMenu";
import CrmCommandPalette from "@/features/crm/components/CrmCommandPalette";

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
      {/* v13.424.0 — Se eliminó el encabezado "CRM" duplicado: el breadcrumb del
          shell ya indica el módulo y cada ruta hija trae su propio PageHeader.
          Antes se veían dos títulos apilados ("CRM" + "Resumen ejecutivo"). */}
      <div className="border-b bg-background">
        <div className="px-4 sm:px-6 flex items-center gap-2 h-11">
          <nav className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 h-11 -mb-px">
            {TABS.map((t) => {
              const showBadge = t.to === "/crm/actividades" && vencidas > 0;
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-2 px-3 h-11 text-sm font-medium border-b-2 whitespace-nowrap transition-colors shrink-0",
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
                    )
                  }
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                  {showBadge && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1 text-2xs font-bold rounded-full">
                      {vencidas > 99 ? "99+" : vencidas}
                    </Badge>
                  )}
                </NavLink>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-border/60">
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
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
      <CrmCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
