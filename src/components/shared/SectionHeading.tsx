/**
 * `<SectionHeading />` — encabezado de sección canónico del ERP.
 *
 * v13.426.0 (Armonización visual global). Antes convivían al menos 6 escalas
 * distintas para el mismo rol (`text-sm font-bold uppercase`, `text-lg
 * font-semibold`, `text-xs font-semibold uppercase`, …). Este componente fija
 * dos únicas escalas:
 *
 *  - `variant="section"` (default): `text-base font-semibold` — título de un
 *    bloque de contenido. Misma escala que `DocumentoSectionTitle`.
 *  - `variant="overline"`: `text-overline` (11px, mayúsculas, muted) — etiqueta
 *    de agrupación dentro de dashboards y paneles densos.
 *
 * Usa `as` para el nivel semántico correcto: `h2` cuando la página ya tiene un
 * `h1` (`PageHeader`/`DetailHeader`), `h3` cuando vive dentro de otra sección.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeadingProps {
  children: ReactNode;
  /** Nivel semántico. Default `h2`. */
  as?: "h2" | "h3";
  variant?: "section" | "overline";
  /** Icono opcional a la izquierda (hereda el color muted). */
  icon?: ReactNode;
  /** Contador en gris junto al título (se oculta si es 0). */
  count?: number;
  /** Acciones alineadas a la derecha. */
  actions?: ReactNode;
  /** `id` del elemento de título (para `aria-labelledby`). */
  id?: string;
  /** Descripción secundaria bajo el título. */
  description?: ReactNode;
  className?: string;
}

const VARIANT_CLASSES = {
  section: "text-section",
  subsection: "text-subsection",
  overline: "text-overline",
} as const;


export function SectionHeading({
  children,
  as: Tag = "h2",
  variant = "section",
  icon,
  count,
  actions,
  id,
  description,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex items-start justify-between gap-2", className)}>
      <div className="min-w-0">
        <Tag id={id} className={cn("flex min-w-0 items-center gap-2", VARIANT_CLASSES[variant])}>
          {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
          <span className="truncate">{children}</span>
          {typeof count === "number" && count > 0 ? (
            <span className="font-normal text-muted-foreground">({count})</span>
          ) : null}
        </Tag>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
