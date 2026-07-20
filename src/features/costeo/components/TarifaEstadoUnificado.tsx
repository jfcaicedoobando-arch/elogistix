/**
 * Badge unificado que combina vigencia técnica + estado de aprobación.
 * v13.135.49: una sola "lectura" del estado real de la tarifa.
 */
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CosteoTarifaEstado } from "@/features/costeo/types";
import { todayLocalISO } from "@/lib/date/today";

interface Props {
  estado: CosteoTarifaEstado;
  estadoAprobacion?: string;
  vigenteHasta: string;
  motivo?: string | null;
}

interface BadgeCfg { label: string; cls: string; pulse?: boolean }

function resolveCfg(props: Props): BadgeCfg {
  const ap = props.estadoAprobacion ?? "vigente";
  const hoy = todayLocalISO();
  const vencida = props.vigenteHasta < hoy;

  if (ap === "rechazada") {
    return { label: "Rechazada", cls: "bg-destructive/15 text-destructive border-destructive/30" };
  }
  if (ap === "borrador") {
    return { label: "Pendiente", cls: "bg-warning/15 text-warning border-warning/30", pulse: true };
  }
  if (props.estado === "reemplazada") {
    return { label: "Reemplazada", cls: "bg-muted text-muted-foreground border-border" };
  }
  if (vencida || props.estado === "vencida") {
    return { label: "Vencida", cls: "bg-destructive/15 text-destructive border-destructive/30" };
  }
  return { label: "Vigente", cls: "bg-success/15 text-success border-success/30" };
}

export function TarifaEstadoUnificado(props: Props) {
  const cfg = resolveCfg(props);
  const badge = (
    <Badge variant="outline" className={`${cfg.cls} gap-1.5`}>
      {cfg.pulse && <span className="size-1.5 rounded-full bg-warning animate-pulse" />}
      {cfg.label}
    </Badge>
  );

  if (cfg.label !== "Rechazada" || !props.motivo) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><span>{badge}</span></TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs"><strong>Motivo:</strong> {props.motivo}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
