import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <CardTitle className="text-base font-semibold">
          {title}
          <span className="ml-2 text-sm font-normal text-muted-foreground">({count})</span>
        </CardTitle>
        {actions}
      </CardHeader>
      <CardContent className="p-0 border-t">{children}</CardContent>
    </Card>
  );
}
