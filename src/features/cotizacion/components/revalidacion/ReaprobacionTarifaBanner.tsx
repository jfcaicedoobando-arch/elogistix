/**
 * Banner mostrado en CotizacionDetalle cuando la cotización está en estado
 * `pendiente_reaprobacion`. Permite a ventas resolver la solicitud disparada
 * por operaciones al revalidar la tarifa con tres opciones:
 *
 * 1. **Re-aprobar manteniendo precio al cliente** — se absorbe el delta y se
 *    crea el embarque con la decisión `reaprobada_ventas`.
 * 2. **Re-cotizar con tarifa vigente** — se archiva la versión actual de la
 *    cotización (`recotizar_cotizacion`), se marca la decisión como
 *    `recotizada` y se navega al wizard de edición para que ventas re-aplique
 *    la tarifa vigente; al guardar y aceptar la nueva versión, el PDF se
 *    regenera por el flujo normal.
 * 3. **Rechazar** — la solicitud queda en histórico, ventas no se compromete.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useResolverReaprobacion } from "@/features/cotizacion/hooks/useRevalidacionTarifa";
import { recotizarCotizacion } from "@/features/cotizacion/services/versionado";
import { notifyError } from "@/lib/ui/appFeedback";

interface Props {
  cotizacionId: string;
  estado: string | null | undefined;
  deltaJsonb?: unknown;
}

export function ReaprobacionTarifaBanner({ cotizacionId, estado, deltaJsonb }: Props) {
  const { mutate, isPending } = useResolverReaprobacion();
  const [recotizando, setRecotizando] = useState(false);
  const navigate = useNavigate();

  if (estado !== "pendiente_reaprobacion") return null;

  const delta = deltaJsonb as
    | { conceptos?: number; total_usd?: number; total_mxn?: number; tarifa_vigente?: boolean; severidad?: string }
    | undefined;
  // B-097: copy según la causa real del bloqueo (vigencia vs precio).
  const tarifaVencida = delta?.tarifa_vigente === false;

  async function handleRecotizar() {
    setRecotizando(true);
    try {
      await recotizarCotizacion(cotizacionId, "Tarifa vigente actualizada por ventas");
      mutate(
        { cotizacionId, decision: "recotizada" },
        {
          onSuccess: () => {
            navigate(`/cotizaciones/${cotizacionId}/editar`);
          },
        },
      );
    } catch (e) {
      notifyError(undefined, {
        title: `No se pudo re-cotizar: ${(e as Error).message}`,
        error: e as Error,
        method: "REVALIDACION_RECOTIZAR",
      });
    } finally {
      setRecotizando(false);
    }
  }

  const disabled = isPending || recotizando;

  return (
    <Alert variant="default" className="border-warning bg-warning/10">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle>Tarifa pendiente de re-aprobación</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {tarifaVencida
            ? "Operaciones detectó que la tarifa vinculada está vencida al crear el embarque."
            : "Operaciones detectó cambios en la tarifa vigente al crear el embarque."}
          {delta?.conceptos ? ` (${delta.conceptos} concepto(s) afectado(s))` : ""}
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => mutate({ cotizacionId, decision: "reaprobada" })}
            disabled={disabled}
          >
            Re-aprobar manteniendo precio al cliente
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRecotizar}
            disabled={disabled}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Re-cotizar con tarifa vigente
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => mutate({ cotizacionId, decision: "rechazada" })}
            disabled={disabled}
          >
            Rechazar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
