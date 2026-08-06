/**
 * Grid financiero para `EliminarFacturaCxpDialog` — Total, Saldo y (opcional)
 * Moneda/TC. Extraído en v13.307.23 para mantener el diálogo bajo 200 líneas.
 */
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";

function formatMonto(moneda: string, monto: number) {
  return `${moneda} ${formatNumber(monto ?? 0, { decimals: 2 })}`;
}

export function EliminarFacturaFinancialGrid({ factura }: { factura: FacturaCxP }) {
  const showMoneda = factura.moneda !== "MXN";
  return (
    <div className={cn("grid gap-3", showMoneda ? "grid-cols-3" : "grid-cols-2")}>
      <div className="bg-card border border-border rounded-lg p-3 flex flex-col justify-between min-h-20">
        <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Total</span>
        <div className="text-sm font-bold text-foreground tabular-nums whitespace-nowrap">
          {formatMonto(factura.moneda, factura.total)}
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-3 flex flex-col justify-between min-h-20">
        <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Saldo pendiente</span>
        <div className={cn(
          "text-sm font-bold tabular-nums whitespace-nowrap",
          factura.saldo > 0 ? "text-warning" : "text-foreground",
        )}>
          {formatMonto(factura.moneda, factura.saldo)}
        </div>
      </div>
      {showMoneda && (
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col justify-between min-h-20">
          <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Moneda / TC</span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-foreground">{factura.moneda}</div>
            <div className="text-label font-medium text-muted-foreground tabular-nums">
              TC {factura.tipo_cambio_usd?.toFixed(2) ?? "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
