import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/SectionHeading";

interface Props {
  title: string;
  count: number;
  /** Acciones alineadas a la derecha del encabezado. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Encabezado estándar de las pestañas de listado en el detalle de cliente
 * (título + contador + acciones) sobre una card con la tabla al ras.
 */
export function ClienteTabSection({ title, count, actions, children }: Props) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 py-3">
        <SectionHeading as="h3" count={count}>{title}</SectionHeading>
        {actions}
      </CardHeader>
      <CardContent className="p-0 border-t">{children}</CardContent>
    </Card>
  );
}
