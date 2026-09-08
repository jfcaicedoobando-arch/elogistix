/**
 * Celda de Folio del listado de Cotizaciones.
 *
 * MEJ-20260908-01: en 1280x720 Tipo/Modo/Ruta/Fecha quedan fuera de la tabla
 * (sólo se muestran desde 2xl). El folio conserva el acceso a esos datos en un
 * tooltip, sin agregar un selector de columnas.
 *
 * Extraída de `cotizacionesColumns.tsx` para respetar el límite de 200 líneas.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatFechaHora } from "@/lib/formatters";
import type { CotizacionListItem } from "@/features/cotizacion/hooks";

/** Folio con los datos secundarios (Tipo, Modo, Ruta, Fecha) a la mano. */
export function FolioCotizacionCell({ cotizacion }: { cotizacion: CotizacionListItem }) {
  const esInfo = cotizacion.tipo_documento === "informativa";
  const detalle = [
    `Tipo: ${esInfo ? "Tarifario" : "Transaccional"}`,
    `Modo: ${cotizacion.modo || "—"}`,
    `Ruta: ${cotizacion.origen || "-"} → ${cotizacion.destino || "-"}`,
    `Fecha: ${cotizacion.created_at ? formatFechaHora(cotizacion.created_at) : "—"}`,
  ].join(" · ");
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span className="block truncate">{cotizacion.folio}</span>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-body-sm max-w-[320px] break-words">
        {detalle}
      </TooltipContent>
    </Tooltip>
  );
}
