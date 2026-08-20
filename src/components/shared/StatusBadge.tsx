/**
 * `<StatusBadge />` — Badge unificado por dominio.
 *
 * Reemplaza los 4 helpers paralelos (`getEstadoColor`, `BadgeCiclo`,
 * `EmbarqueBadgeAdmin`, `renderEstadoVigencia`). Los estilos vienen del
 * `statusRegistry`, que a su vez consume la fuente de verdad
 * `src/lib/ui/estadoConfig.ts`.
 */
import { cn } from "@/lib/utils";
import { getStatusVisual, type StatusDomain } from "@/lib/status/statusRegistry";
import { Hint } from "@/components/shared/Hint";

export interface StatusBadgeProps {
  domain: StatusDomain;
  status: string | null | undefined;
  /** Muestra el icono asociado al estado (si el registry lo tiene). */
  showIcon?: boolean;
  /** Etiqueta forzada (por defecto usa la del registry). */
  label?: string;
  /** Contenido libre (tiene prioridad sobre `label`). */
  children?: React.ReactNode;
  /** Tooltip nativo opcional (explicación corta del marcador). */
  title?: string;
  className?: string;
}

export function StatusBadge({
  domain,
  status,
  showIcon = false,
  label,
  children,
  title,
  className,
}: StatusBadgeProps) {
  const visual = getStatusVisual(domain, status);
  const Icon = visual.icon;
  return (
    <Hint label={title}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
          visual.badgeClass,
          className,
        )}
        data-domain={domain}
        data-status={status ?? ""}
      >
        {showIcon && Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
        <span>{children ?? label ?? visual.label}</span>
      </span>
    </Hint>
  );
}

