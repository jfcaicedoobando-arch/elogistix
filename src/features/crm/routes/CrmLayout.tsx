import { useState, useCallback, useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Target, Users, UserCheck, Activity, BarChart3, LayoutDashboard, Settings, Sun, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useActividadesVencidasCount } from "@/features/crm/hooks";
import { useCrmHotkeys } from "@/features/crm/hooks";
import { usePermissions } from "@/hooks/shared";
import QuickAddMenu from "@/features/crm/components/QuickAddMenu";
import CrmCommandPalette from "@/features/crm/components/CrmCommandPalette";
import { tabsUnderlineTriggerClass } from "@/components/ui/tabs";

const TABS = [
  { to: "/crm/mi-dia", label: "Mi día", icon: Sun, end: false },
  { to: "/crm", label: "Resumen", icon: LayoutDashboard, end: true },
  { to: "/crm/leads", label: "Leads", icon: Users, end: false },
  { to: "/crm/prospectos", label: "Prospectos", icon: UserCheck, end: false },
  { to: "/crm/oportunidades", label: "Oportunidades", icon: Target, end: false },
  { to: "/crm/actividades", label: "Actividades", icon: Activity, end: false },
  { to: "/crm/higiene", label: "Higiene", icon: ShieldCheck, end: false },
  { to: "/crm/analitica", label: "Analítica", icon: BarChart3, end: false },
];

export default function CrmLayout() {
  const { data: vencidas = 0 } = useActividadesVencidasCount();
  const {
    canConfigurarCrm, canCrearLead, canCrearOportunidad, canCrearActividad,
    canGestionarLeadsEnLote,
  } = usePermissions();
  // El botón "Nuevo" sólo existe si al menos un alta es realmente posible.
  const puedeAlgunaAlta =
    canCrearLead || canCrearOportunidad || canCrearActividad || canGestionarLeadsEnLote;
  const [openTrigger, setOpenTrigger] = useState(0);
  const [dialogTrigger, setDialogTrigger] = useState<{ kind: "lead" | "oportunidad" | "actividad"; n: number } | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const noop = useCallback(() => {}, []);
  const handlers = useMemo(
    () => ({
      onOpenQuick: puedeAlgunaAlta ? () => setOpenTrigger((n) => n + 1) : noop,
      onNewLead: canCrearLead ? () => setDialogTrigger((p) => ({ kind: "lead" as const, n: (p?.n ?? 0) + 1 })) : noop,
      onNewOportunidad: canCrearOportunidad ? () => setDialogTrigger((p) => ({ kind: "oportunidad" as const, n: (p?.n ?? 0) + 1 })) : noop,
      onNewActividad: canCrearActividad ? () => setDialogTrigger((p) => ({ kind: "actividad" as const, n: (p?.n ?? 0) + 1 })) : noop,
      onOpenPalette: () => setPaletteOpen(true),
    }),
    [puedeAlgunaAlta, canCrearLead, canCrearOportunidad, canCrearActividad, noop],
  );
  useCrmHotkeys(handlers);

  return (
    <div className="flex flex-col h-full">
      {/* v13.424.0 — Se eliminó el encabezado "CRM" duplicado: el breadcrumb del
          shell ya indica el módulo y cada ruta hija trae su propio PageHeader.
          Antes se veían dos títulos apilados ("CRM" + "Resumen ejecutivo"). */}
      <div className="border-b bg-background">
        {/* E-5 (auditoría 2026-08-24): en móvil el botón "Nuevo" se encimaba con
            los sub-tabs porque ambos compartían una sola fila fija. Ahora el
            layout apila tabs y acciones en columnas <sm y las acciones quedan
            en su propia franja, sin overlap. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-0 px-2 sm:px-6 sm:h-11">
          <nav
            className="flex items-center gap-1 overflow-x-auto snap-x flex-1 min-w-0 h-11 -mb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Secciones del CRM"
          >
            {TABS.map((t) => {
              const showBadge = t.to === "/crm/actividades" && vencidas > 0;
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    cn(
                      tabsUnderlineTriggerClass,
                      "h-11 pb-0 gap-2 shrink-0 snap-start",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )
                  }
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                  {showBadge && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1 text-label font-bold rounded-full">
                      {vencidas > 99 ? "99+" : vencidas}
                    </Badge>
                  )}
                </NavLink>
              );
            })}
          </nav>
          <div className="flex items-center justify-end gap-2 shrink-0 py-1 sm:py-0 sm:pl-2 border-t sm:border-t-0 sm:border-l border-border/60">
            {puedeAlgunaAlta && <QuickAddMenu openTrigger={openTrigger} dialogTrigger={dialogTrigger} />}
            {/* Ola 6 (O6.3): el ícono de configuración sigue el mismo permiso
                que la ruta /crm/configuracion (admin del tenant + gerente
                comercial), no el permiso amplio de edición del CRM. */}
            {canConfigurarCrm && (
              <NavLink
                to="/crm/configuracion"
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center justify-center w-9 h-9 rounded-md text-body transition-colors",
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
