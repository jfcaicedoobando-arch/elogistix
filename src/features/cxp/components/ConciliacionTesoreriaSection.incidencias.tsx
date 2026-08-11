/**
 * Incidencias detectadas por la conciliación de tesorería (v13.396.0):
 * pagos sin movimiento bancario o con importe distinto al del banco.
 *
 * v13.495.0 — Las incidencias "sin movimiento" se pueden reparar en el momento
 * con el botón "Regenerar movimiento" (RPC `regenerar_movimiento_pago_proveedor`).
 */
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTimeShort } from "@/lib/formatters";
import type { IncidenciaConciliacion } from "@/features/cxp/services/conciliacionTesoreria";
import { useRegenerarMovimientoPago } from "@/features/cxp/hooks/useRegenerarMovimientoPago";

interface Props {
  incidencias: IncidenciaConciliacion[];
  monedaFactura: string;
}

const ETIQUETA: Record<IncidenciaConciliacion["tipo"], string> = {
  sin_movimiento: "Sin movimiento en banco",
  descuadre: "Importe distinto al banco",
};

export function ConciliacionIncidencias({ incidencias, monedaFactura }: Props) {
  const regenerar = useRegenerarMovimientoPago();
  if (incidencias.length === 0) return null;

  const faltantes = incidencias.filter((i) => i.tipo === "sin_movimiento").length;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground">
        Pagos por revisar ({incidencias.length})
        {faltantes > 0 && ` · ${faltantes} sin movimiento en banco`}
      </h4>
      <ul className="divide-y rounded-md border">
        {incidencias.map((i) => (
          <li key={i.pagoId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <Badge variant={i.tipo === "descuadre" ? "destructive" : "secondary"}>
              {ETIQUETA[i.tipo]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDateTimeShort(i.fechaPago)}
            </span>
            <span className="text-sm tabular-nums">
              Pago {formatCurrency(i.monto, i.moneda || monedaFactura)}
            </span>
            {i.tipo === "descuadre" && (
              <span className="text-xs text-muted-foreground tabular-nums">
                Banco {formatCurrency(i.cargoMxn, "MXN")} · esperado{" "}
                {formatCurrency(i.montoEsperadoMxn, "MXN")}
              </span>
            )}
            {i.tipo === "sin_movimiento" && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => regenerar.mutate(i.pagoId)}
                disabled={regenerar.isPending}
              >
                <RefreshCw
                  className={regenerar.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                  aria-hidden
                />
                Regenerar movimiento
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
