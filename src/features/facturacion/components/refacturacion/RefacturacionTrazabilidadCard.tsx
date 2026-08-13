/**
 * RefacturacionTrazabilidadCard — sección de trazabilidad del caso de
 * refacturación: expediente (caso, facturas, pagos) + línea de tiempo de
 * movimientos con quién y cuándo ejecutó cada paso.
 */
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { useRefacturacionExpediente } from "@/features/facturacion/hooks/useRefacturacionExpediente";
import { RefacturacionExpedienteResumen } from "./RefacturacionExpedienteResumen";
import { RefacturacionTimeline } from "./RefacturacionTimeline";

interface Props {
  casoId: string | null;
  /** Sin tarjeta: para embeberlo dentro de un modal que ya aporta el marco. */
  embebido?: boolean;
}

export function RefacturacionTrazabilidadCard({ casoId, embebido = false }: Props) {
  const { expediente, eventos, isLoading, isError, refetch } =
    useRefacturacionExpediente(casoId);

  if (!casoId) return null;

  const cuerpo = isLoading ? (
    <ListSkeleton rows={4} />
  ) : isError || !expediente ? (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        No se pudo cargar la trazabilidad de este caso.
      </p>
      <Button variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>
    </div>
  ) : (
    <div className="space-y-5">
      <RefacturacionExpedienteResumen exp={expediente} />
      <div className="space-y-2">
        <p className="text-sm font-medium">Movimientos del caso</p>
        <RefacturacionTimeline eventos={eventos} />
      </div>
    </div>
  );

  if (embebido) return cuerpo;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden />
          Trazabilidad de la refacturación
        </CardTitle>
      </CardHeader>
      <CardContent>{cuerpo}</CardContent>
    </Card>
  );
}
