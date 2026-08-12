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
    <div
      className={cn(
        // v13.548.0: el riel se coloca al costado desde `xl` (1280). En `lg`
        // dejaba la columna principal en ~380px y la tabla de conceptos se
        // cortaba; ahora debajo de 1280 el historial se apila al final.
        "grid grid-cols-1 gap-4 xl:grid-cols-[1fr_19rem] 2xl:grid-cols-[1fr_21rem]",

        className,
      )}
    >
      <div className="min-w-0 space-y-4">{children}</div>
      <aside className="min-w-0 space-y-4" aria-label="Actividad del documento">
        {rail}
      </aside>
    </div>
  );
}
