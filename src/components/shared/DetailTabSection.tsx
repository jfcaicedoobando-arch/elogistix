import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** Contador opcional junto al título. */
  count?: number;
  /** Acciones alineadas a la derecha del encabezado. */
  actions?: ReactNode;
  /** `true` (default) deja la tabla al ras; `false` agrega padding al cuerpo. */
  flush?: boolean;
  children: ReactNode;
}

/**
 * Envoltorio canónico de las pestañas de detalle (Cliente, Proveedor, …):
 * card con encabezado (título + contador + acciones) y cuerpo al ras para
 * tablas embebidas. Antes vivía duplicado como `ClienteTabSection` y como
 * `Card`+`CardTitle` a mano en el detalle de proveedor.
 */
export function DetailTabSection({ title, count, actions, flush = true, children }: Props) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 py-3">
        <SectionHeading as="h3" count={count}>
          {title}
        </SectionHeading>
        {actions}
      </CardHeader>
      <CardContent className={cn("border-t", flush ? "p-0 overflow-x-auto" : "pt-4")}>
        {children}
      </CardContent>
    </Card>
  );
}
