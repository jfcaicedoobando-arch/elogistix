/**
 * Título de sección dentro de una pestaña de documento financiero.
 * Estandariza tipografía e icono para que facturas emitidas, facturas de
 * proveedor y proformas usen exactamente el mismo encabezado de sección.
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/shared/SectionHeading";

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
    <SectionHeading
      as="h3"
      icon={icon}
      count={count}
      actions={actions}
      className={cn("border-b pb-2", className)}
    >
      {title}
    </SectionHeading>
  );
}
