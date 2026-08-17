import { TrendingUp, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";

interface Props {
  total: number;
  aceptadas: number;
  rechazadas: number;
  tasa: number;
}

/**
 * KPIs del listado de cotizaciones (últimos 30 días).
 * VF-10: el periodo queda explícito para que no se compare con el conteo de la
 * tabla, que sí depende de los filtros activos.
 */
export function CotizacionesKpis({ total, aceptadas, rechazadas, tasa }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        KPIs de los últimos 30 días · no dependen de los filtros de la tabla
      </p>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total cotizaciones (30 días)" value={total} icon={BarChart3} variant="info" iconVariant="chip" />
        <KpiCard label="Aceptadas" value={aceptadas} icon={CheckCircle} variant="success" iconVariant="chip" />
        <KpiCard label="Rechazadas" value={rechazadas} icon={XCircle} variant="destructive" iconVariant="chip" />
        <KpiCard label="Tasa de conversión" value={`${tasa}%`} icon={TrendingUp} variant="accent" iconVariant="chip" />
      </div>
    </div>
  );
}
