/** KPIs de la bandeja /compras/por-aprobar. Extraído por Power-of-10 #4. */
import { ClipboardCheck, CheckCircle2, XCircle } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";
import { sumaMxn, sumaUsd } from "./ComprasPorAprobar.helpers";

interface FacturaLike { moneda?: string | null; total?: number | null }

interface Props<T> {
  pendientes: T[];
  aprobadas: T[];
  rechazadas: T[];
  rows: T[];
  aprobacion: string;
  currentTotalMxn: number;
  currentTotalUsd: number;
}

const plural = (n: number) => (n === 1 ? "factura" : "facturas");

export function ComprasPorAprobarKpis<T extends FacturaLike>({
  pendientes, aprobadas, rechazadas, rows, aprobacion, currentTotalMxn, currentTotalUsd,
}: Props<T>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={ClipboardCheck}
        label="Pendientes"
        value={`${pendientes.length} ${plural(pendientes.length)}`}
        sublabel={`${formatCurrency(sumaMxn(pendientes), "MXN")} · ${formatCurrency(sumaUsd(pendientes), "USD")}`}
        variant="warning"
      />
      <KpiCard icon={CheckCircle2} label="Aprobadas" value={`${aprobadas.length} ${plural(aprobadas.length)}`} variant="success" />
      <KpiCard icon={XCircle} label="Rechazadas" value={`${rechazadas.length} ${plural(rechazadas.length)}`} variant="destructive" />
      <KpiCard
        icon={ClipboardCheck}
        label={`Total en vista (${aprobacion})`}
        value={`${rows.length} ${plural(rows.length)}`}
        sublabel={`${formatCurrency(currentTotalMxn, "MXN")} · ${formatCurrency(currentTotalUsd, "USD")}`}
      />
    </div>
  );
}
