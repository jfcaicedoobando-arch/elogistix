/**
 * `<PortalPageShell />` — encabezado y ritmo vertical estándar de las
 * páginas del portal de cliente.
 *
 * Ola G2: antes cada página del portal repetía el mismo bloque
 * `<div className="space-y-6"><PageHeader .../>{...}</div>`. Este shell lo
 * centraliza para que el portal comparta exactamente el mismo `PageHeader`
 * (título, icono, acciones) que el resto del ERP.
 */
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";

export interface PortalPageShellProps {
  /** Icono a la izquierda del título (mismo slot que `PageHeader`). */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Acciones alineadas a la derecha del encabezado. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PortalPageShell({
  icon,
  title,
  description,
  actions,
  children,
  className,
}: PortalPageShellProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <PageHeader icon={icon} title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}
