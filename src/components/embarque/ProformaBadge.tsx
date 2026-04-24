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
          ? "bg-emerald-50 text-emerald-700 border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700"
          : "bg-orange-50 text-orange-700 border-orange-400 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-700",
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
