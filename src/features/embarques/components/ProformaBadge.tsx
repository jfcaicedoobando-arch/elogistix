import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  tieneProforma: boolean | null | undefined;
  size?: "sm" | "lg";
  className?: string;
}

/**
 * Badge visual para indicar si un embarque tiene proforma generada.
 * NO es un estado del flujo operativo, es un indicador independiente.
 */
export function ProformaBadge({ tieneProforma, size = "lg", className }: Props) {
  const isLarge = size === "lg";
  const tiene = !!tieneProforma;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-semibold border-2",
        isLarge ? "text-sm px-3 py-1.5" : "text-xs px-2 py-0.5",
        tiene
          ? "bg-success/10 [color:hsl(var(--success))] border-success/40"
          : "bg-warning/10 [color:hsl(var(--warning))] border-warning/40",
        className,
      )}
    >
      {tiene ? (
        <>
          <CheckCircle2 className={cn(isLarge ? "h-4 w-4" : "h-3 w-3")} />
          PROFORMA GENERADA
        </>
      ) : (
        <>
          <AlertTriangle className={cn(isLarge ? "h-4 w-4" : "h-3 w-3")} />
          SIN PROFORMA
        </>
      )}
    </Badge>
  );
}
