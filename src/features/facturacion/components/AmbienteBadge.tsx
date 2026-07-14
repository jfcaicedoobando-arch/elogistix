/**
 * AmbienteBadge — muestra un badge naranja "SANDBOX" cuando un CFDI se
 * timbró en modo de pruebas de Facturapi. Para documentos de producción
 * (`live`) o sin ambiente registrado no renderiza nada, para no meter
 * ruido visual en el flujo normal.
 */
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  ambiente: "sandbox" | "live" | null | undefined;
  /** Tamaño del badge. `sm` es el default (para tablas). */
  size?: "sm" | "md";
  className?: string;
}

export function AmbienteBadge({ ambiente, size = "sm", className }: Props) {
  if (ambiente !== "sandbox") return null;
  const sizeCls = size === "md" ? "text-xs px-2 py-0.5" : "text-[10px] px-1.5 py-0";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`bg-warning/15 text-warning border-warning/40 font-semibold uppercase tracking-wide ${sizeCls} ${className ?? ""}`}
          aria-label="Documento timbrado en ambiente sandbox — no válido ante el SAT"
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          Sandbox
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        Este CFDI se timbró en el ambiente de pruebas de Facturapi. <strong>No es válido ante el SAT</strong> ni puede entregarse al cliente como comprobante fiscal.
      </TooltipContent>
    </Tooltip>
  );
}
