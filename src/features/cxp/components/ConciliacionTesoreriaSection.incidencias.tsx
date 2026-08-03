/**
 * Incidencias detectadas por la conciliación de tesorería (v13.396.0):
 * pagos sin movimiento bancario o con importe distinto al del banco.
 */
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTimeShort } from "@/lib/formatters";
import type { IncidenciaConciliacion } from "@/features/cxp/services/conciliacionTesoreria";

interface Props {
  incidencias: IncidenciaConciliacion[];
  monedaFactura: string;
}

const ETIQUETA: Record<IncidenciaConciliacion["tipo"], string> = {
  sin_movimiento: "Sin movimiento en banco",
  descuadre: "Importe distinto al banco",
};

export function ConciliacionIncidencias({ incidencias, monedaFactura }: Props) {
  if (incidencias.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground">
        Pagos por revisar ({incidencias.length})
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
          </li>
        ))}
      </ul>
    </div>
  );
}
