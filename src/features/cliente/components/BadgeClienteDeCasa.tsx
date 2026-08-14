/**
 * v13.624.0 — Distintivo para clientes que no requieren autorización
 * ("cliente de casa"). Se muestra en cotizaciones y proformas.
 */
import { Badge } from "@/components/ui/badge";
import { Home } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  /** Documento al que aplica el aviso ("cliente" = ficha del cliente). */
  tipo: "cotizacion" | "proforma" | "cliente";
}

const TEXTOS: Record<Props["tipo"], string> = {
  cotizacion:
    "Este cliente no requiere autorizar cotizaciones: el equipo puede aceptarla internamente.",
  proforma:
    "Este cliente no requiere autorizar proformas: el equipo puede aprobarla internamente.",
  cliente:
    "Cliente de casa: no requiere autorización del cliente en cotizaciones ni proformas.",
};

export function BadgeClienteDeCasa({ tipo }: Props) {
  const texto = TEXTOS[tipo];
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
