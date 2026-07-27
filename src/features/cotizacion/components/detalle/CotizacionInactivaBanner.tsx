import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, AlertTriangle } from "lucide-react";
import { useReactivarCotizacion } from "@/features/cotizacion/hooks";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/formatters";
import { puedeReactivar } from "@/features/cotizacion/domain/lifecycle";

interface Props {
  cotizacionId: string;
  estado: string;
  updatedAt?: string | null;
  canEdit: boolean;
}

/**
 * Banner que se muestra cuando una cotización fue marcada como
 * "Vencida" o "Archivada" por el housekeeping automático.
 * Permite reactivarla (vuelve a su estado anterior).
 */
export function CotizacionInactivaBanner({ cotizacionId, estado, updatedAt, canEdit }: Props) {
  const reactivar = useReactivarCotizacion();

  if (!puedeReactivar(estado)) return null;

  const esArchivada = estado === "Archivada";
  const Icono = esArchivada ? Archive : AlertTriangle;
  const fechaTxt = updatedAt ? formatDate(updatedAt, "dd/MM/yyyy") : null;

  const handleReactivar = async () => {
    try {
      const nuevo = await reactivar.mutateAsync(cotizacionId);
      notifySuccess(undefined, {
        title: "Cotización reactivada",
        description: `Volvió al estado "${nuevo}". Recuerda revisar las tarifas antes de enviarla.`,
      });
    } catch (err: unknown) {
      notifyError(undefined, {
        title: "No se pudo reactivar",
        description: getErrorMessage(err),
        error: err,
        method: "REACTIVAR_COTIZACION",
      });
    }
  };

  return (
    <Alert variant={esArchivada ? "default" : "destructive"}>
      <Icono className="h-4 w-4" />
      <AlertTitle>
        {esArchivada ? "Cotización archivada" : "Cotización vencida"}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {esArchivada
            ? "Se archivó automáticamente por inactividad prolongada."
            : "Esta cotización expiró por inactividad o porque pasó su fecha de vigencia."}
          {fechaTxt && <> Último cambio: {fechaTxt}. </>}
          Las tarifas pueden estar desactualizadas.
        </span>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleReactivar}
            disabled={reactivar.isPending}
            className="shrink-0"
          >
            <ArchiveRestore className="h-4 w-4 mr-1" />
            {reactivar.isPending ? "Reactivando…" : "Reactivar"}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
