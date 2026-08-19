/**
 * KPIs del libro maestro de pagos: cobrado, pagado, neto y número de pagos.
 * Todos los importes se muestran en MXN al tipo de cambio de cada pago.
 * v13.5xx: migrado a `KpiCard` — plano por defecto, color sólo en alarma (neto negativo).
 */
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";
import type { TotalesLibroPagos } from "@/features/tesoreria/domain/libroPagos";

interface Props {
  totales: TotalesLibroPagos;
  isLoading: boolean;
}

export function LibroPagosKpis({ totales, isLoading }: Props) {
  const netoNegativo = totales.netoMxn < 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Cobrado a clientes" value={formatCurrency(totales.cobradoMxn, "MXN")} loading={isLoading} />
        <KpiCard label="Pagado a proveedores" value={formatCurrency(totales.pagadoMxn, "MXN")} loading={isLoading} />
        <KpiCard
          label="Neto del periodo"
          value={formatCurrency(totales.netoMxn, "MXN")}
          variant={netoNegativo ? "destructive" : "default"}
          loading={isLoading}
        />
        <KpiCard label="Pagos registrados" value={String(totales.conteo)} loading={isLoading} />
      </div>
      <p className="text-body-sm text-muted-foreground">
        Los equivalentes en pesos usan el tipo de cambio guardado en cada pago, no el del día de hoy.
      </p>
    </div>
  );
}
