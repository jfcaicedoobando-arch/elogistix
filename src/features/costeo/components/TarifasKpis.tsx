/**
 * Tira de KPIs para la matriz de tarifas marítimas, con indicador de filtro activo.
 * Migrada al KpiCard canónico para cohesión con el resto del ERP.
 */
import { CheckCircle2, Clock, AlertTriangle, Route } from "lucide-react";
import { KpiCard, type KpiVariant } from "@/components/shared/KpiCard";
import { cn } from "@/lib/utils";
import { todayLocalISO } from "@/lib/date/today";
import { calcularKpisTarifas } from "@/features/costeo/utils/vigenciaTarifa";

interface TarifaLike {
  vigente_desde?: string;
  vigente_hasta: string;
  estado: string;
  estado_aprobacion?: string;
  ruta_id?: string;
}

interface Props {
  tarifas: TarifaLike[];
  onFilterPendientes?: () => void;
  onFilterPorVencer?: () => void;
  activeKpi?: "vigentes" | "porVencer" | "pendientes" | null;
}

/** Anillo de "filtro activo" con el mismo token semántico que la variant de la card. */
const activeRing: Record<KpiVariant, string> = {
  default: "ring-2 ring-muted-foreground/40",
  success: "ring-2 ring-success/60",
  warning: "ring-2 ring-warning/60",
  destructive: "ring-2 ring-destructive/60",
  info: "ring-2 ring-info/60",
  accent: "ring-2 ring-accent/60",
  secondary: "ring-2 ring-secondary/60",
};

export function TarifasKpis({ tarifas, onFilterPendientes, onFilterPorVencer, activeKpi }: Props) {
  // P1-1/P2-4/P2-5: misma regla que ranking y filtro (utils/vigenciaTarifa).
  const k = calcularKpisTarifas(tarifas, todayLocalISO());

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 short:gap-2 [&>div>div]:short:py-2.5">
      <KpiCard
        label="Vigentes hoy"
        value={k.vigentes}
        icon={CheckCircle2}
        variant="success"
        className={cn(activeKpi === "vigentes" && activeRing.success)}
      />
      <KpiCard
        label="Por vencer ≤ 7 días"
        value={k.porVencer}
        icon={Clock}
        variant="warning"
        onClick={k.porVencer > 0 ? onFilterPorVencer : undefined}
        className={cn(activeKpi === "porVencer" && activeRing.warning)}
      />
      <KpiCard
        label="Pendientes aprobación"
        value={k.pendientes}
        hint={k.borradoresVencidos > 0 ? `+${k.borradoresVencidos} borradores vencidos (requieren renovar vigencia)` : undefined}
        icon={AlertTriangle}
        variant="info"
        onClick={k.pendientes + k.borradoresVencidos > 0 ? onFilterPendientes : undefined}
        className={cn(activeKpi === "pendientes" && activeRing.info)}
      />
      <KpiCard
        label="Rutas cubiertas"
        value={k.rutasCubiertas}
        icon={Route}
        hint="Rutas con al menos una tarifa utilizable hoy (según filtros de agente/contenedor)"
      />
    </div>
  );
}
