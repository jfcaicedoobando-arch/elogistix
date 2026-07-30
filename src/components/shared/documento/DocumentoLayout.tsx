/**
 * Layout de documento financiero (estilo Odoo): contenido principal a la
 * izquierda y riel de bitácora/actividad a la derecha, que en pantallas
 * chicas se apila al final.
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** Columna derecha: bitácora, historial, avisos contextuales. */
  rail?: ReactNode;
  className?: string;
}

export function DocumentoLayout({ children, rail, className }: Props) {
  if (!rail) {
    return <div className={cn("space-y-4", className)}>{children}</div>;
  }
  return (
    <div className={cn("grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]", className)}>
      <div className="min-w-0 space-y-4">{children}</div>
      <aside className="min-w-0 space-y-4" aria-label="Actividad del documento">
        {rail}
      </aside>
    </div>
  );
}
