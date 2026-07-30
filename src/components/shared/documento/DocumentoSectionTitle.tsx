/**
 * Título de sección dentro de una pestaña de documento financiero.
 * Estandariza tipografía e icono para que facturas emitidas, facturas de
 * proveedor y proformas usen exactamente el mismo encabezado de sección.
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  icon?: ReactNode;
  /** Contador opcional mostrado en gris junto al título. */
  count?: number;
  /** Acciones alineadas a la derecha (botones pequeños). */
  actions?: ReactNode;
  className?: string;
}

export function DocumentoSectionTitle({ title, icon, count, actions, className }: Props) {
  return (
    <div className={cn("flex items-center justify-between gap-2 border-b pb-2", className)}>
      <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold">
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
        <span className="truncate">{title}</span>
        {typeof count === "number" && count > 0 ? (
          <span className="font-normal text-muted-foreground">({count})</span>
        ) : null}
      </h3>
      {actions}
    </div>
  );
}
