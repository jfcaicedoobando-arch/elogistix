import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import type { EmbarqueRow } from "@/features/embarques/hooks";
import { derivarEstadoContenedor } from "@/features/embarques/utils/estadoContenedorCell";

export interface ContenedorInfo { count: number; primero: string; incompletos?: number }

interface ContenedorCellProps {
  embarque: EmbarqueRow;
  info?: ContenedorInfo;
  legacyCount?: number;
}

/**
 * Celda de la columna "Contenedores" en la tabla de embarques.
 * Extraída de `embarqueColumns.tsx` para mantener el archivo padre bajo el
 * límite de 200 líneas (Power of 10).
 */
export function ContenedorCell({ embarque: e, info, legacyCount }: ContenedorCellProps) {
  const { count, primero, pendientes, pendientesTitle, esLcl } = derivarEstadoContenedor(e, info, legacyCount);
  const mostrarLcl = esLcl && !primero;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="truncate max-w-[80px]" title={primero || (mostrarLcl ? "LCL · sin contenedor asignado" : "")}>
        {primero || (mostrarLcl ? "—" : "-")}
      </span>
      {mostrarLcl && (
        <Badge variant="secondary" className="text-2xs px-1.5 py-0 h-4" title="LCL · sin contenedor asignado">LCL</Badge>
      )}
      {count > 1 && (
        <Badge variant="secondary" className="text-2xs px-1.5 py-0 h-4" title={`${count} contenedores agrupados`}>+{count - 1}</Badge>
      )}
      {pendientes && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-2xs px-1.5 py-0 h-4 border-warning text-warning">Datos pendientes</Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{pendientesTitle}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  );
}
