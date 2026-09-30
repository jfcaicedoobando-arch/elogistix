import { KpiCard } from "@/components/shared/KpiCard";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  kpis: {
    devengado_mes_mxn: number;
    pendiente_liquidar_mxn: number;
    liquidado_mes_mxn: number;
  } | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

export function ComisionesKpis({ kpis, loading, error, onRetry }: Props) {
  if (error) {
    return (
      <ErrorState
        title="Indicadores de comisiones no disponibles"
        description="La lista puede estar disponible, pero no se pudieron calcular los importes. Reintenta antes de usarlos."
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <KpiCard label="Devengado del mes" value={kpis ? formatCurrency(kpis.devengado_mes_mxn, "MXN") : ""} loading={loading} />
      <KpiCard label="Pendiente de liquidar" value={kpis ? formatCurrency(kpis.pendiente_liquidar_mxn, "MXN") : ""} loading={loading} />
      <KpiCard label="Liquidado del mes" value={kpis ? formatCurrency(kpis.liquidado_mes_mxn, "MXN") : ""} loading={loading} />
    </div>
  );
}
