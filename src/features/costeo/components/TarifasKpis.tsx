/**
 * Tira de KPIs para la matriz de tarifas marítimas, con indicador de filtro activo.
 * Migrada al KpiCard canónico para cohesión con el resto del ERP.
 */
import { CheckCircle2, Clock, AlertTriangle, Route } from "lucide-react";
import { KpiCard, type KpiVariant } from "@/components/shared/KpiCard";
import { cn } from "@/lib/utils";
import { diasHastaFecha, parseDateOnlyLocal } from "@/lib/date/dateOnly";

interface TarifaLike {
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
  const today = new Date().setHours(0, 0, 0, 0);
  let vigentes = 0;
  let porVencer = 0;
  let pendientes = 0;
  const rutas = new Set<string>();

  for (const t of tarifas) {
    const ap = t.estado_aprobacion ?? "vigente";
    if (ap === "borrador") pendientes++;
    // B-089: vigente_hasta es date-only → medianoche LOCAL (no UTC).
    const hasta = parseDateOnlyLocal(t.vigente_hasta).getTime();
    if (ap === "vigente" && hasta >= today && t.estado !== "reemplazada") {
      vigentes++;
      if (diasHastaFecha(t.vigente_hasta) <= 7) porVencer++;
    }
    if (t.ruta_id) rutas.add(t.ruta_id);
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        label="Vigentes hoy"
        value={vigentes}
        icon={CheckCircle2}
        variant="success"
        className={cn(activeKpi === "vigentes" && activeRing.success)}
      />
      <KpiCard
        label="Por vencer ≤ 7 días"
        value={porVencer}
        icon={Clock}
        variant="warning"
        onClick={porVencer > 0 ? onFilterPorVencer : undefined}
        className={cn(activeKpi === "porVencer" && activeRing.warning)}
      />
      <KpiCard
        label="Pendientes aprobación"
        value={pendientes}
        icon={AlertTriangle}
        variant="info"
        onClick={pendientes > 0 ? onFilterPendientes : undefined}
        className={cn(activeKpi === "pendientes" && activeRing.info)}
      />
      <KpiCard label="Rutas cubiertas" value={rutas.size} icon={Route} />
    </div>
  );
}
