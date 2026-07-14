import { Wallet, AlertCircle, Container, Clock } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  totalDeposito: number;
  totalPendiente: number;
  count: number;
  diasPromRecuperacion: number | null;
}

/**
 * KPIs de garantías — migrados al `KpiCard` canónico para unificar tipografía
 * y padding con el resto del sistema (font-semibold, sin uppercase, p-4).
 */
export function GarantiasKpiCards({
  totalDeposito,
  totalPendiente,
  count,
  diasPromRecuperacion,
}: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard
        label="Depósito total"
        value={formatCurrency(totalDeposito, "USD")}
        icon={Wallet}
        variant="info"
      />
      <KpiCard
        label="Por recuperar"
        value={formatCurrency(totalPendiente, "USD")}
        icon={AlertCircle}
        variant="warning"
      />
      <KpiCard
        label="Contenedores"
        value={count}
        icon={Container}
        variant="success"
      />
      <KpiCard
        label="Días prom. recuperación"
        value={diasPromRecuperacion !== null ? `${diasPromRecuperacion} d` : "—"}
        icon={Clock}
      />
    </div>
  );
}
