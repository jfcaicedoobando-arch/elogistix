/**
 * Badge unificado que combina vigencia técnica + estado de aprobación.
 * v13.135.49: una sola "lectura" del estado real de la tarifa.
 *
 * Ola 2 · RN-3: el color lo resuelve el `statusRegistry` (dominio
 * `tarifa_maritima`); aquí sólo se decide QUÉ estado mostrar.
 */
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { CosteoTarifaEstado } from "@/features/costeo/types";
import { todayLocalISO } from "@/lib/date/today";

interface Props {
  estado: CosteoTarifaEstado;
  estadoAprobacion?: string;
  vigenteHasta: string;
  motivo?: string | null;
}

/** Estado canónico del dominio `tarifa_maritima`. */
function resolverEstadoTarifa(props: Props): string {
  const ap = props.estadoAprobacion ?? "vigente";
  const hoy = todayLocalISO();
  const vencida = props.vigenteHasta < hoy;

  if (ap === "rechazada") return "Rechazada";
  if (ap === "borrador") return "Pendiente";
  if (props.estado === "reemplazada") return "Reemplazada";
  if (vencida || props.estado === "vencida") return "Vencida";
  return "Vigente";
}

export function TarifaEstadoUnificado(props: Props) {
  const estado = resolverEstadoTarifa(props);
  const badge = <StatusBadge domain="tarifa_maritima" status={estado} />;

  if (estado !== "Rechazada" || !props.motivo) return badge;

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
