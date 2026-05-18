import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import type { CotizacionListItem } from "@/hooks/cotizacion";

/**
 * Render de la celda combinada Estado + Vigencia.
 * - Estado siempre como badge primario.
 * - Vigencia como línea secundaria con tono según urgencia (solo cuando estado="Enviada").
 */
export function renderEstadoVigencia(r: CotizacionListItem): ReactNode {
  const estado = r.estado || "—";
  let vigenciaNode: ReactNode = null;

  if (r.fecha_vigencia) {
    const fechaStr = formatDate(r.fecha_vigencia);
    const esEnviada = (r.estado || "").toLowerCase() === "enviada";

    if (!esEnviada) {
      vigenciaNode = <span className="text-muted-foreground">Vence {fechaStr}</span>;
    } else {
      const fecha = new Date(r.fecha_vigencia);
      const hoy = new Date();
      const diffDias = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias < 0) {
        vigenciaNode = <span className="text-destructive font-medium">Vencida · {fechaStr}</span>;
      } else if (diffDias <= 3) {
        vigenciaNode = (
          <span className="text-warning font-medium">
            {diffDias === 0 ? "Vence hoy" : `Vence en ${diffDias}d`} · {fechaStr}
          </span>
        );
      } else {
        vigenciaNode = <span className="text-muted-foreground">Vence {fechaStr}</span>;
      }
    }
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <Badge
        variant="secondary"
        className={`w-fit text-xs whitespace-nowrap ${getEstadoColor(estado)}`}
      >
        {estado}
      </Badge>
      {vigenciaNode && <span className="text-[10px] whitespace-nowrap">{vigenciaNode}</span>}
    </div>
  );
}
