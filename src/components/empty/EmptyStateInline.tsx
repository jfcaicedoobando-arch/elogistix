import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Empty/loading state COMPACTO para usar dentro de cards o secciones
 * (no es la versión grande de página completa — para eso ver `EmptyState`).
 *
 * Uso:
 *   <EmptyStateInline icon={Receipt} message="No hay proformas generadas." />
 *   <EmptyStateInline loading message="Cargando eventos..." />
 *   <EmptyStateInline icon={Ship} message="Sin navieras." density="compact"
 *     action={{ label: "Dar de alta", to: "/catalogos/navieras" }} />
 */
export interface EmptyStateInlineAction {
  label: string;
  /** Ruta interna (react-router). Tiene prioridad sobre onClick. */
  to?: string;
  onClick?: () => void;
}

interface Props {
  /** Icono Lucide a mostrar (ignorado si loading=true) */
  icon?: LucideIcon;
  /** Texto principal */
  message: string;
  /** Texto secundario opcional */
  hint?: string;
  /** Muestra spinner en vez de icono */
  loading?: boolean;
  /** CTA opcional (ruta interna o handler) */
  action?: EmptyStateInlineAction;
  /** `compact` reduce el padding para popovers, celdas y dropdowns */
  density?: "compact" | "default";
  /** Clases extra (por defecto py-8) */
  className?: string;
  /** Contenido extra bajo la acción (p. ej. un CTA compuesto que no encaja en `action`) */
  children?: ReactNode;
}

export function EmptyStateInline({
  icon: Icon,
  message,
  hint,
  loading = false,
  action,
  density = "default",
  className,
  children,
}: Props) {
  const compact = density === "compact";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center text-muted-foreground",
        compact ? "gap-1 py-3 px-3" : "gap-2 py-8 px-4",
        className,
      )}
    >
      {loading ? (
        <Loader2
          className={cn("animate-spin opacity-60", compact ? "h-4 w-4" : "h-6 w-6")}
        />
      ) : Icon ? (
        <Icon
          className={cn("opacity-40", compact ? "h-5 w-5" : "h-8 w-8")}
          strokeWidth={1.5}
        />
      ) : null}
      <p className={compact ? "text-xs" : "text-sm"}>{message}</p>
      {hint && <p className="text-xs opacity-75 max-w-xs">{hint}</p>}
      {action && (
        <Button
          variant="outline"
          size="sm"
          className={compact ? "mt-1 h-7 text-xs" : "mt-2"}
          onClick={action.to ? undefined : action.onClick}
          asChild={!!action.to}
        >
          {action.to ? <Link to={action.to}>{action.label}</Link> : action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
