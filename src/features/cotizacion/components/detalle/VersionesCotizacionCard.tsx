/**
 * P3 (v13.297.0) — Panel de Versiones (snapshots inmutables) de una cotización.
 * Muestra la línea de tiempo de versiones creadas cuando la cotización pasó
 * a estado "Enviada". Cada versión conserva el folio, estado y el `snapshot`
 * completo de la fila + `costos_snapshot`.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { useVersionesCotizacion } from "@/features/cotizacion/hooks/useCotizacionVersiones";

interface Props {
  cotizacionId: string;
}

export function VersionesCotizacionCard({ cotizacionId }: Props) {
  const { data: versiones = [], isLoading } = useVersionesCotizacion(cotizacionId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Historial de versiones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (versiones.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" /> Historial de versiones
          <Badge variant="outline" className="ml-1 text-2xs">
            {versiones.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Cada vez que la cotización pasa a <strong>Enviada</strong> se congela
          una versión inmutable con folio, conceptos y costos vigentes.
        </p>
        <ul className="divide-y divide-border/60 rounded-md border">
          {versiones.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant="secondary" className="shrink-0">
                  v{v.version_num}
                </Badge>
                <span className="font-medium truncate">{v.folio}</span>
                <Badge variant="outline" className="text-2xs shrink-0">
                  {v.estado_al_snapshot}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(v.created_at)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
