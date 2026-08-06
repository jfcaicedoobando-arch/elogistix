/**
 * Wrapper de sección dentro de un FormDialogShell.
 * Renderiza un sub-encabezado discreto + grid responsivo (1 col mobile, 2 col desktop).
 * Usar para agrupar campos de un formulario en bloques temáticos (p.ej. "Datos fiscales").
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  title?: string;
  description?: string;
  /** Cuando true, los hijos NO se envuelven en un grid (útil para componentes que ya manejan su layout). */
  flat?: boolean;
  /** Columnas del grid en desktop (default 2). */
  cols?: 1 | 2;
  className?: string;
  children: ReactNode;
}

export function FormDialogSection({ title, description, flat, cols = 2, children, className }: Props) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || description) && (
        <header className="space-y-0.5">
          {title && (
            <h3 className="text-overline font-semibold">
              {title}
            </h3>
          )}
          {description && <p className="text-xs text-muted-foreground/80">{description}</p>}
        </header>
      )}
      {flat ? (
        children
      ) : (
        <div className={cn("grid gap-3", cols === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
          {children}
        </div>
      )}
    </section>
  );
}
