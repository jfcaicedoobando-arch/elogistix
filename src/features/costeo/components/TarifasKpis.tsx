/**
 * Tarjetas KPI para la matriz de tarifas marítimas.
 * v13.135.48: cuenta vigentes, por vencer, pendientes y rutas cubiertas.
 */
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertTriangle, Route } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
}

const DAY_MS = 86_400_000;

function daysUntil(date: string): number {
  const target = new Date(date).getTime();
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.floor((target - today) / DAY_MS);
}

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: "success" | "warning" | "info" | "neutral";
  onClick?: () => void;
  hint?: string;
}

const toneClasses: Record<KpiCardProps["tone"], string> = {
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  info: "text-primary bg-primary/10",
  neutral: "text-muted-foreground bg-muted",
};

function KpiCard({ label, value, icon: Icon, tone, onClick, hint }: KpiCardProps) {
  const interactive = !!onClick;
  return (
    <Card
      className={`p-4 flex items-center gap-3 ${interactive ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter") onClick?.(); } : undefined}
    >
      <div className={`size-10 rounded-md flex items-center justify-center ${toneClasses[tone]}`}>
        <Icon className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums leading-tight">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</div>}
      </div>
    </Card>
  );
}

export function TarifasKpis({ tarifas, onFilterPendientes, onFilterPorVencer }: Props) {
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard label="Vigentes hoy" value={vigentes} icon={CheckCircle2} tone="success" />
      <KpiCard
        label="Por vencer ≤ 7 días"
        value={porVencer}
        icon={Clock}
        tone="warning"
        onClick={porVencer > 0 ? onFilterPorVencer : undefined}
        hint={porVencer > 0 ? "Click para filtrar" : undefined}
      />
      <KpiCard
        label="Pendientes aprobación"
        value={pendientes}
        icon={AlertTriangle}
        tone="info"
        onClick={pendientes > 0 ? onFilterPendientes : undefined}
        hint={pendientes > 0 ? "Click para revisar" : undefined}
      />
      <KpiCard label="Rutas cubiertas" value={rutas.size} icon={Route} tone="neutral" />
    </div>
  );
}
