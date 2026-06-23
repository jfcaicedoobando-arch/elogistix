/**
 * Badge para el estado de aprobación de una tarifa.
 * Si está rechazada, muestra tooltip con el motivo.
 */
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  estado: string;
  motivo?: string | null;
}

export function EstadoAprobacionBadge({ estado, motivo }: Props) {
  const badge = (() => {
    if (estado === "vigente") return <Badge className="bg-success text-success-foreground">Aprobada</Badge>;
    if (estado === "borrador") return <Badge className="bg-warning text-warning-foreground">Pendiente</Badge>;
    if (estado === "rechazada") return <Badge variant="destructive">Rechazada</Badge>;
    return <Badge variant="outline">{estado}</Badge>;
  })();

  if (estado !== "rechazada" || !motivo) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><span>{badge}</span></TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs"><strong>Motivo:</strong> {motivo}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
