/**
 * Conciliación automática de tesorería en el detalle de la factura de proveedor
 * (v13.396.0). Recalcula el saldo pendiente del proveedor y el estatus de la
 * factura a partir de los pagos y movimientos bancarios registrados.
 */
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { formatFechaHoraMx } from "@/lib/date/formatMx";
import { useConciliacionAutomaticaFactura } from "@/features/cxp/hooks/useConciliarTesoreria";
import { resumenConciliacion } from "@/features/cxp/services/conciliacionResumen";
import { ConciliacionIncidencias } from "./ConciliacionTesoreriaSection.incidencias";

interface Props {
  facturaId: string;
  monedaFactura: string;
}

export function ConciliacionTesoreriaSection({ facturaId, monedaFactura }: Props) {
  const conciliar = useConciliacionAutomaticaFactura(facturaId);
  const reporte = conciliar.data ?? null;
  const resumen = resumenConciliacion(reporte);
  const factura = reporte?.facturas.find((f) => f.facturaId === facturaId) ?? null;

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">Conciliación de tesorería</h3>
          <p className="text-xs text-muted-foreground">
            Saldo y estatus recalculados a partir de los pagos y movimientos bancarios registrados.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => conciliar.mutate({ facturaId })}
          disabled={conciliar.isPending}
        >
          <RefreshCw className={conciliar.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {conciliar.isPending ? "Conciliando…" : "Volver a conciliar"}
        </Button>
      </header>

      <div className="rounded-md border divide-y">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5">
          {resumen.cuadrado ? (
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" aria-hidden />
          )}
          <span className="text-sm">{resumen.mensaje}</span>
          {reporte?.conciliadoAt && (
            <span className="ml-auto text-xs text-muted-foreground">
              {formatFechaHoraMx(reporte.conciliadoAt)}
            </span>
          )}
        </div>

        {factura && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground text-xs">Esta factura</span>
            <span className="tabular-nums">
              Pagado {formatCurrency(factura.pagado, factura.moneda)}
            </span>
            <span className="tabular-nums font-medium">
              Saldo {formatCurrency(factura.saldo, factura.moneda)}
            </span>
            <Badge variant="outline">{factura.estado}</Badge>
            <span className="text-xs text-muted-foreground">
              {factura.pagos} pago(s) · {factura.movimientos} movimiento(s)
            </span>
          </div>
        )}

        {resumen.saldoPorMoneda.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground text-xs">Saldo pendiente del proveedor</span>
            {resumen.saldoPorMoneda.map((s) => (
              <span key={s.moneda} className="tabular-nums">
                {formatCurrency(s.saldo, s.moneda)}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({s.facturasAbiertas} abierta{s.facturasAbiertas === 1 ? "" : "s"})
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      <ConciliacionIncidencias
        incidencias={reporte?.incidencias ?? []}
        monedaFactura={monedaFactura}
      />
    </section>
  );
}
