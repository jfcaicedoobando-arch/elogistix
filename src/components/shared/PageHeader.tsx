import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Título principal de la página (renderizado como <h1>). */
  title: ReactNode;
  /** Descripción secundaria opcional bajo el título. */
  description?: ReactNode;
  /** Icono opcional renderizado a la izquierda del título. */
  icon?: ReactNode;
  /** Acciones (botones, filtros) alineadas a la derecha en md+. */
  actions?: ReactNode;
  /** Clases extra para el contenedor raíz. */
  className?: string;
}

/**
 * Encabezado de página estandarizado.
 *
 * Estándar visual del sistema:
 *  - <h1> con `text-2xl font-bold tracking-tight` y color heredado (foreground).
 *  - Descripción con `text-sm text-muted-foreground` y `mt-1` para separación
 *    consistente respecto al título.
 *  - Layout flex responsive: título e icono a la izquierda, acciones a la
 *    derecha en md+, apilado en mobile.
 *
 * Reemplaza el patrón duplicado en ~25 páginas de listado y detalle.
 */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-start md:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          {icon}
          <span className="truncate">{title}</span>
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
