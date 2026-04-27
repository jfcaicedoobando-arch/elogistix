import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Empty/loading state COMPACTO para usar dentro de cards o secciones
 * (no es la versión grande de página completa — para eso ver `EmptyState`).
 *
 * Uso:
 *   <EmptyStateInline icon={Receipt} message="No hay proformas generadas." />
 *   <EmptyStateInline loading message="Cargando eventos..." />
 */
interface Props {
  /** Icono Lucide a mostrar (ignorado si loading=true) */
  icon?: LucideIcon;
  /** Texto principal */
  message: string;
  /** Texto secundario opcional */
  hint?: string;
  /** Muestra spinner en vez de icono */
  loading?: boolean;
  /** Clases extra (por defecto py-8) */
  className?: string;
}

export function EmptyStateInline({
  icon: Icon,
  message,
  hint,
  loading = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center py-8 px-4 text-muted-foreground",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin opacity-60" />
      ) : Icon ? (
        <Icon className="h-8 w-8 opacity-40" strokeWidth={1.5} />
      ) : null}
      <p className="text-sm">{message}</p>
      {hint && <p className="text-xs opacity-75 max-w-xs">{hint}</p>}
    </div>
  );
}
