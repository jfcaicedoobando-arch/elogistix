/**
 * Fila de 4 KPIs del panel de salud de Edge Functions.
 *
 * v13.426.0 — Armonización global: se eliminó el clon local de `KpiCard` y se
 * usa la tarjeta KPI canónica (`@/components/shared/KpiCard`), igual que los
 * dashboards de Compras, CxP y Facturación.
 */
import { Activity, AlertTriangle, Bug, Clock } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatNumber } from "@/lib/formatters";

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
        icon={Activity}
        label="Eventos"
        value={formatNumber(totalEvents)}
        sublabel={`${activeFns} funciones activas`}
      />
      <KpiCard
        icon={Bug}
        label="Errores"
        value={formatNumber(totalErrors)}
        sublabel={`${errorRatePct.toFixed(2)}% del total`}
        variant={totalErrors > 0 ? "destructive" : "default"}
      />
      <KpiCard
        icon={AlertTriangle}
        label="Advertencias"
        value={formatNumber(totalWarns)}
        variant={totalWarns > 0 ? "warning" : "default"}
      />
      <KpiCard
        icon={Clock}
        label="Funciones con error"
        value={formatNumber(affectedFns)}
        sublabel={`en ${rangeLabel.toLowerCase()}`}
        variant={affectedFns > 0 ? "destructive" : "default"}
      />
    </div>
  );
}
