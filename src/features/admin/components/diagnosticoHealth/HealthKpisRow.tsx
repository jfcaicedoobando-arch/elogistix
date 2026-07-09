/**
 * KPI card individual y la fila de 4 KPIs para el panel de salud.
 * Extraído de `DiagnosticoHealthPanel`.
 */
import { Activity, AlertTriangle, Bug, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/formatters";

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "error";
}

function KpiCard({ icon, label, value, hint, tone }: KpiCardProps) {
  const toneCls =
    tone === "error" ? "text-destructive"
    : tone === "warn" ? "text-warning"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <div className={`mt-2 text-2xl font-semibold ${toneCls}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

interface Props {
  totalEvents: number;
  totalErrors: number;
  totalWarns: number;
  affectedFns: number;
  errorRatePct: number;
  activeFns: number;
  rangeLabel: string;
}

export default function HealthKpisRow({
  totalEvents, totalErrors, totalWarns, affectedFns, errorRatePct, activeFns, rangeLabel,
}: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={<Activity className="h-4 w-4" />}
        label="Eventos"
        value={formatNumber(totalEvents)}
        hint={`${activeFns} funciones activas`}
      />
      <KpiCard
        icon={<Bug className="h-4 w-4" />}
        label="Errores"
        value={formatNumber(totalErrors)}
        hint={`${errorRatePct.toFixed(2)}% del total`}
        tone={totalErrors > 0 ? "error" : "default"}
      />
      <KpiCard
        icon={<AlertTriangle className="h-4 w-4" />}
        label="Advertencias"
        value={formatNumber(totalWarns)}
        tone={totalWarns > 0 ? "warn" : "default"}
      />
      <KpiCard
        icon={<Clock className="h-4 w-4" />}
        label="Funciones con error"
        value={formatNumber(affectedFns)}
        hint={`en ${rangeLabel.toLowerCase()}`}
        tone={affectedFns > 0 ? "error" : "default"}
      />
    </div>
  );
}
