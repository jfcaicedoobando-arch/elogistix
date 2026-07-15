/**
 * Fase J · Fila de la tabla Vs Real con barra de cumplimiento y badge "Excede".
 */
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters/numbers";
import { cn } from "@/lib/utils";
import type { FilaVsReal } from "@/features/presupuesto/services";

interface Props {
  fila: FilaVsReal;
  striped: boolean;
}

function tono(pct: number): string {
  if (pct > 110) return "bg-destructive";
  if (pct > 100) return "bg-warning";
  return "bg-success";
}

export function VsRealFila({ fila, striped }: Props) {
  const sinPresup = fila.presupuesto_mxn === 0;
  const exceso = !sinPresup && fila.cumplimiento_pct > 110;
  const varClass = sinPresup ? "text-muted-foreground" : fila.variacion_mxn > 0 ? "text-destructive" : "text-success";
  const ancho = Math.min(100, Math.max(0, fila.cumplimiento_pct));
  return (
    <tr className={cn("border-t", striped && "bg-muted/20")}>
      <td className="px-3 py-2 font-medium">
        <div className="flex items-center gap-2">
          <span>{fila.categoria_nombre}</span>
          {exceso && <Badge variant="destructive" className="text-2xs">Excede</Badge>}
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(fila.presupuesto_mxn, "MXN")}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(fila.real_mxn, "MXN")}</td>
      <td className={cn("px-3 py-2 text-right tabular-nums font-medium", varClass)}>
        {formatCurrency(fila.variacion_mxn, "MXN")}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {sinPresup ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex items-center gap-2 justify-end">
            <div className="h-1.5 w-16 rounded bg-muted overflow-hidden shrink-0" aria-hidden>
              <div className={cn("h-full", tono(fila.cumplimiento_pct))} style={{ width: `${ancho}%` }} />
            </div>
            <span className="w-14 text-right">{fila.cumplimiento_pct.toFixed(1)}%</span>
          </div>
        )}
      </td>
    </tr>
  );
}
