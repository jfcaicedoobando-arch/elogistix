import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/components/shared/utils/uiMappings";
import type { CotizacionListItem } from "@/features/cotizacion/hooks";

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

  // Badge "Sin costos" cuando la cotización se creó sin desglose y aún no
  // tiene filas en `cotizacion_costos` (v13.29.0). La regla canónica es el
  // conteo real, no el flag, así desaparece automáticamente al cargar costos.
  const sinCostos =
    !!r.sin_desglose_costos && ((r.cotizacion_costos_count ?? 0) === 0);

  // Badge "Tarifa vencida": cuando la cotización está aceptada y la tarifa
  // vinculada ya no es vigente, ventas/operaciones debería revisarla antes de
  // crear el embarque. Se calcula con la fecha del JOIN — sin RPC extra.
  const vigHasta = (r as { tarifa_vigente_hasta?: string | null }).tarifa_vigente_hasta;
  const tarifaVencida =
    !!vigHasta &&
    (r.estado || "").toLowerCase() === "aceptada" &&
    new Date(vigHasta) < new Date(new Date().toISOString().slice(0, 10));

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge
          variant="secondary"
          className={`w-fit text-xs whitespace-nowrap ${getEstadoColor(estado)}`}
        >
          {estado}
        </Badge>
        {sinCostos && (
          <Badge variant="warning" className="w-fit text-[10px] whitespace-nowrap">
            Sin costos
          </Badge>
        )}
        {(r as { estado_revalidacion?: string }).estado_revalidacion === "pendiente_reaprobacion" && (
          <Badge variant="warning" className="w-fit text-[10px] whitespace-nowrap" title="Tarifa cambió: requiere re-aprobación de ventas">
            ⚠ Re-aprobación pendiente
          </Badge>
        )}
        {tarifaVencida && (
          <Badge
            variant="destructive"
            className="w-fit text-[10px] whitespace-nowrap"
            title={`La tarifa vinculada venció el ${formatDate(vigHasta!)}`}
          >
            ⚠ Tarifa vencida
          </Badge>
        )}
      </div>
      {vigenciaNode && <span className="text-[10px] whitespace-nowrap">{vigenciaNode}</span>}
    </div>
  );
}
