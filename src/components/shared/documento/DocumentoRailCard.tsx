/**
 * Tarjeta del riel derecho de un documento financiero. Unifica el título
 * ("Historial y actividad"), el icono y el espaciado en facturas emitidas,
 * facturas de proveedor y proformas.
 */
import { type ReactNode } from "react";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  title?: string;
  /** Contador opcional de eventos. */
  count?: number;
  children: ReactNode;
}

export function DocumentoRailCard({
  title = "Historial y actividad",
  count,
  children,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <History className="h-4 w-4 text-muted-foreground" />
          {title}
          {typeof count === "number" && count > 0 ? (
            <Badge variant="secondary" className="font-normal">{count}</Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[32rem] overflow-y-auto">{children}</CardContent>
    </Card>
  );
}
