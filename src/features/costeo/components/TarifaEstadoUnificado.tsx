/**
 * Badge unificado que combina vigencia técnica + estado de aprobación.
 * v13.135.49: una sola "lectura" del estado real de la tarifa.
 *
 * Ola 2 · RN-3: el color lo resuelve el `statusRegistry` (dominio
 * `tarifa_maritima`); aquí sólo se decide QUÉ estado mostrar.
 *
 * FIX vigencia: un borrador con `vigente_hasta` vencida ya no se muestra
 * como "Pendiente" a secas — se avisa con un texto visible (no sólo tooltip).
 */
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { CosteoTarifaEstado } from "@/features/costeo/types";
import { todayLocalISO } from "@/lib/date/today";
import { resolverEstadoVigenciaTarifa } from "@/features/costeo/utils/vigenciaTarifa";

interface Props {
  estado: CosteoTarifaEstado;
  estadoAprobacion?: string;
  vigenteHasta: string;
  motivo?: string | null;
}

export function TarifaEstadoUnificado(props: Props) {
  const { estadoCanonico, advertencia } = resolverEstadoVigenciaTarifa({
    estadoAprobacion: props.estadoAprobacion,
    estado: props.estado,
    vigenteHasta: props.vigenteHasta,
    hoy: todayLocalISO(),
  });

  const badge = <StatusBadge domain="tarifa_maritima" status={estadoCanonico} />;

  if (advertencia) {
    return (
      <div className="flex flex-col gap-0.5">
        {badge}
        <span className="text-label text-warning">{advertencia}</span>
      </div>
    );
  }

  if (estadoCanonico !== "Rechazada" || !props.motivo) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><span>{badge}</span></TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-label"><strong>Motivo:</strong> {props.motivo}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
