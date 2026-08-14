/**
 * v13.624.0 — Distintivo para clientes que no requieren autorización
 * ("cliente de casa"). Se muestra en cotizaciones y proformas.
 */
import { Badge } from "@/components/ui/badge";
import { Home } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  /** Documento al que aplica el aviso. */
  tipo: "cotizacion" | "proforma";
}

export function BadgeClienteDeCasa({ tipo }: Props) {
  const texto =
    tipo === "cotizacion"
      ? "Este cliente no requiere autorizar cotizaciones: el equipo puede aceptarla internamente."
      : "Este cliente no requiere autorizar proformas: el equipo puede aprobarla internamente.";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="gap-1">
          <Home className="h-3 w-3" />
          Cliente de casa
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{texto}</TooltipContent>
    </Tooltip>
  );
}
