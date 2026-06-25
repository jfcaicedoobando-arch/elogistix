/**
 * Tira de KPIs compacta para la matriz de tarifas marítimas.
 * v13.135.52: rediseño compacto (~56px) con indicador de filtro activo.
 */
import { CheckCircle2, Clock, AlertTriangle, Route } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

const DAY_MS = 86_400_000;

function daysUntil(date: string): number {
  const target = new Date(date).getTime();
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.floor((target - today) / DAY_MS);
}

type Tone = "success" | "warning" | "info" | "neutral";

const toneIcon: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-primary",
  neutral: "text-muted-foreground",
};

const toneActive: Record<Tone, string> = {
  success: "border-success/60 bg-success/5",
  warning: "border-warning/60 bg-warning/5",
  info: "border-primary/60 bg-primary/5",
  neutral: "border-muted",
};

interface KpiProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: Tone;
  onClick?: () => void;
  active?: boolean;
}

function Kpi({ label, value, icon: Icon, tone, onClick, active }: KpiProps) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
        interactive ? "hover:bg-muted/50 cursor-pointer" : "cursor-default",
        active ? toneActive[tone] : "border-border bg-card",
      )}
    >
      <Icon className={cn("size-4 shrink-0", toneIcon[tone])} />
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-lg font-semibold tabular-nums leading-none">{value}</span>
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
    </button>
  );
}

export function TarifasKpis({ tarifas, onFilterPendientes, onFilterPorVencer, activeKpi }: Props) {
  const today = new Date().setHours(0, 0, 0, 0);
  let vigentes = 0;
  let porVencer = 0;
  let pendientes = 0;
  const rutas = new Set<string>();

  for (const t of tarifas) {
    const ap = t.estado_aprobacion ?? "vigente";
    if (ap === "borrador") pendientes++;
    const hasta = new Date(t.vigente_hasta).getTime();
    if (ap === "vigente" && hasta >= today && t.estado !== "reemplazada") {
      vigentes++;
      if (daysUntil(t.vigente_hasta) <= 7) porVencer++;
    }
    if (t.ruta_id) rutas.add(t.ruta_id);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Kpi label="vigentes hoy" value={vigentes} icon={CheckCircle2} tone="success" active={activeKpi === "vigentes"} />
      <Kpi
        label="por vencer ≤ 7 días"
        value={porVencer}
        icon={Clock}
        tone="warning"
        onClick={porVencer > 0 ? onFilterPorVencer : undefined}
        active={activeKpi === "porVencer"}
      />
      <Kpi
        label="pendientes aprobación"
        value={pendientes}
        icon={AlertTriangle}
        tone="info"
        onClick={pendientes > 0 ? onFilterPendientes : undefined}
        active={activeKpi === "pendientes"}
      />
      <Kpi label="rutas cubiertas" value={rutas.size} icon={Route} tone="neutral" />
    </div>
  );
}
