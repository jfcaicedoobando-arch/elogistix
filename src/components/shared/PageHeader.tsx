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
  /** Subheader opcional (chips, breadcrumbs secundarios, meta). Va bajo la descripción. */
  subHeader?: ReactNode;
  /** Tabs opcionales renderizadas al pie del header — full-width. */
  tabs?: ReactNode;
  /** Clases extra para el contenedor raíz. */
  className?: string;
}

/**
 * Encabezado de página estandarizado.
 *
 * Estándar visual del sistema:
 *  - <h1> con `text-display font-bold tracking-tight` (token fluido en tailwind.config.ts).
 *  - Descripción con `text-body text-muted-foreground` y `mt-1` para separación
 *    consistente respecto al título.
 *  - Layout flex responsive: título e icono a la izquierda, acciones a la
 *    derecha en md+, apilado en mobile.
 *  - Slots opcionales `subHeader` (bajo la descripción) y `tabs` (pie del header).
 *
 * Reemplaza el patrón duplicado en ~25 páginas de listado y detalle.
 */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  subHeader,
  tabs,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-3 short:space-y-2", className)}>
      {/* En tableta (md..lg) el header apila: título full-width evita truncado con
          acciones (Tesorería, Cotizaciones, Utilidad) — flex-row en lg+.
          E-7 (auditoría visual 2026-08-24): en móvil las acciones ya vienen
          colapsadas en un menú "…", así que vuelven a la línea del título para no
          dejar una banda vacía bajo el subtítulo.
          v13.823.25 (fold 692px): el corte pasa de `sm` a `md` para que 640–767px
          —donde `useIsMobile()` sigue siendo true— use el layout móvil y no deje
          un renglón vacío con sólo el botón "…". */}
      <div className="flex flex-row items-start justify-between gap-3 md:flex-col lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-display font-bold tracking-tight">
            {icon}
            <span className="truncate">{title}</span>
          </h1>
          {description ? (
            <p className="mt-1 text-body text-muted-foreground line-clamp-2">{description}</p>
          ) : null}
          {subHeader ? <div className="mt-2">{subHeader}</div> : null}
        </div>
        {actions ? (
          // <md: acciones en la misma línea del título (menú compacto).
          // md..lg: fila propia alineada a la derecha. lg+: sin envolver.
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 w-auto md:w-full lg:w-auto lg:flex-nowrap lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>


      {tabs ? <div className="pt-1">{tabs}</div> : null}
    </div>
  );
}
