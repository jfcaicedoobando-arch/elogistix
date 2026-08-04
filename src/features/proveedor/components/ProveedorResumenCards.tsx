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
  /** Totales en moneda nativa, para mostrar el desglose sin conversión. */
  porMoneda?: Record<string, number>;
  /** Monedas con saldo que no se pudieron convertir a MXN. */
  monedasSinTc?: string[];
}

export function ProveedorResumenCards({
  totalFacturado,
  totalPagado,
  totalPendiente,
  moneda,
  operacionesCount,
  porMoneda = {},
  monedasSinTc = [],
}: Props) {
  const opsLabel = operacionesCount === 1 ? "operación" : "operaciones";
  const pctPagado =
    totalFacturado > 0
      ? Math.min(100, Math.max(0, (totalPagado / totalFacturado) * 100))
      : 0;
  const monedasNativas = Object.entries(porMoneda).filter(([, monto]) => monto !== 0);
  const variasMonedas = monedasNativas.length > 1;

  return (
    <div className="space-y-3">
      <KpiStrip desktopCols={3}>
        <KpiCard
          label="Total costeado"
          value={formatCurrency(totalFacturado, moneda)}
          sublabel={`${operacionesCount} ${opsLabel}${variasMonedas ? " · equivalente en MXN" : ""}`}
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

      {(variasMonedas || monedasSinTc.length > 0) && (
        <div className="text-xs text-muted-foreground">
          {variasMonedas && (
            <span>
              Desglose nativo:{" "}
              {monedasNativas
                .map(([mon, monto]) => formatCurrency(monto, mon))
                .join(" · ")}
            </span>
          )}
          {monedasSinTc.length > 0 && (
            <span className="text-warning">
              {variasMonedas ? " · " : ""}
              {monedasSinTc.join(", ")} sin tipo de cambio: no se incluye en el equivalente
            </span>
          )}
        </div>
      )}

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
