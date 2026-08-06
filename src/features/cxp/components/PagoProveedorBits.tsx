/**
 * Subcomponentes pequeños del DialogRegistrarPagoProveedor.
 * v13.303.95 · Rediseño alineado al design language del detalle CxP:
 * chip-folio inline + dot de estado + KPI grid con énfasis en Saldo.
 */
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";
import { Kpi } from "./DialogDetallePagosProveedor.parts";
import { EstadoAprobacionDot } from "./EstadoAprobacionDot";

export function PagoFacturaHeaderInfo({ factura }: { factura: FacturaCxP }) {
  const conSaldo = factura.saldo > 0.01;
  const vencida = factura.dias_vencido > 0;
  return (
    <div className="space-y-2.5 short:space-y-2 -mt-1">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-mono font-semibold uppercase tracking-wider border">
          {factura.folio_interno}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          Folio prov. <span className="font-mono">{factura.folio_proveedor}</span> · {factura.proveedor_nombre}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap px-3 py-2 short:py-1.5 rounded-md bg-accent/5 border">
        <EstadoAprobacionDot estado={factura.estado_aprobacion} cancelada={factura.estado === "Cancelada"} />
        {vencida && (
          <>
            <span className="h-4 w-px bg-border" aria-hidden />
            <span className="text-xs font-semibold text-destructive uppercase tracking-wide">
              Vencida · {factura.dias_vencido} d
            </span>
          </>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 short:gap-2">
        <Kpi label="Total" value={formatCurrency(factura.total, factura.moneda)} />
        <Kpi label="Pagado" value={formatCurrency(factura.pagado, factura.moneda)} tone="success" />
        <Kpi
          label="Saldo pendiente"
          value={formatCurrency(factura.saldo, factura.moneda)}
          tone={conSaldo ? "warn" : "default"}
          emphasis={conSaldo}
        />
        <Kpi
          label="Moneda"
          value={factura.moneda}
          hint={
            factura.tipo_cambio_usd > 0 && factura.moneda !== "MXN"
              ? `TC ${factura.tipo_cambio_usd.toFixed(2)}`
              : undefined
          }
        />
      </div>
    </div>
  );
}


export function PagoSaldoRestante({
  factura, saldoRestante, excede,
}: { factura: FacturaCxP | null; saldoRestante: number; excede: boolean }) {
  return (
    <>
      <div className="rounded-lg border bg-muted/40 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Saldo restante tras el pago</span>
        <span className={cn(
          "text-lg font-semibold tabular-nums",
          excede ? "text-destructive" : saldoRestante === 0 ? "text-success" : "text-foreground",
        )}>
          {factura ? formatCurrency(saldoRestante, factura.moneda) : "—"}
        </span>
      </div>
      {excede && <p className="text-xs text-destructive">El monto excede el saldo pendiente.</p>}
    </>
  );
}
