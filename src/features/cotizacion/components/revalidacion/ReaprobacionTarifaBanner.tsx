/**
 * Banner mostrado en CotizacionDetalle cuando la cotización está en estado
 * `pendiente_reaprobacion`. Permite a ventas re-aprobar o rechazar la
 * solicitud disparada por operaciones al revalidar la tarifa.
 */
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useResolverReaprobacion } from "@/features/cotizacion/hooks/useRevalidacionTarifa";

interface Props {
  cotizacionId: string;
  estado: string | null | undefined;
  deltaJsonb?: unknown;
}

export function ReaprobacionTarifaBanner({ cotizacionId, estado, deltaJsonb }: Props) {
  const { mutate, isPending } = useResolverReaprobacion();
  if (estado !== "pendiente_reaprobacion") return null;

  const delta = deltaJsonb as
    | { conceptos?: number; total_usd?: number; total_mxn?: number }
    | undefined;

  return (
    <Alert variant="default" className="border-yellow-500 bg-yellow-50">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertTitle>Tarifa pendiente de re-aprobación</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Operaciones detectó cambios en la tarifa vigente al crear el embarque.
          {delta?.conceptos ? ` (${delta.conceptos} concepto(s) afectado(s))` : ""}
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => mutate({ cotizacionId, decision: "reaprobada" })}
            disabled={isPending}
          >
            Re-aprobar manteniendo precio al cliente
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => mutate({ cotizacionId, decision: "rechazada" })}
            disabled={isPending}
          >
            Rechazar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
