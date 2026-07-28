/**
 * Banda de resumen financiero del proveedor: KPIs canónicos (Facturado /
 * Pagado / Pendiente) + barra de proporción pagado vs. pendiente.
 *
 * v13.320.65 — Extraído de `ProveedorDetalle.tsx` durante la auditoría visual
 * del detalle de proveedor. Reemplaza la rejilla ad-hoc `md:grid-cols-3` con
 * sub-grid anidada, que se desbordaba en 768 px y dejaba huecos en desktop.
 */
import { Receipt, CheckCircle2, Clock } from "lucide-react";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  totalFacturado: number;
  totalPagado: number;
  totalPendiente: number;
  moneda: string;
  operacionesCount: number;
}

export function ProveedorResumenCards({
  totalFacturado,
  totalPagado,
  totalPendiente,
  moneda,
  operacionesCount,
}: Props) {
  const opsLabel = operacionesCount === 1 ? "operación" : "operaciones";
  const pctPagado =
    totalFacturado > 0
      ? Math.min(100, Math.max(0, (totalPagado / totalFacturado) * 100))
      : 0;

  return (
    <div className="space-y-3">
      <KpiStrip desktopCols={3}>
        <KpiCard
          label="Total facturado"
          value={formatCurrency(totalFacturado, moneda)}
          sublabel={`${operacionesCount} ${opsLabel}`}
          icon={Receipt}
          iconVariant="chip"
        />
        <KpiCard
          label="Pagado"
          value={formatCurrency(totalPagado, moneda)}
          sublabel={`${pctPagado.toFixed(0)}% del total`}
          icon={CheckCircle2}
          iconVariant="chip"
          variant="success"
        />
        <KpiCard
          label="Pendiente"
          value={formatCurrency(totalPendiente, moneda)}
          sublabel={`${(100 - pctPagado).toFixed(0)}% del total`}
          icon={Clock}
          iconVariant="chip"
          variant={totalPendiente > 0 ? "warning" : "default"}
        />
      </KpiStrip>

      {totalFacturado > 0 && (
        <div className="space-y-1.5">
          <div
            className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${pctPagado.toFixed(0)}% pagado del total facturado`}
          >
            <div className="bg-success" style={{ width: `${pctPagado}%` }} />
            <div className="flex-1 bg-warning/60" />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Pagado {pctPagado.toFixed(0)}%</span>
            <span>Pendiente {(100 - pctPagado).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
