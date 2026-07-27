/**
 * ClaimPendingBanner (v13.303.2 / FIX-04.1)
 *
 * Se muestra cuando `facturas.facturapi_id` empieza con `PENDING:<uuid>`. Ese
 * prefijo lo pone `facturapi-emitir` para reclamar la fila; si el edge muere
 * antes del UPDATE final, la factura queda "huérfana": bloqueada para
 * retimbrar y sin `uuid_fiscal`. Este banner permite al usuario invocar
 * `facturapi-recuperar-claim` para reconciliar contra FacturAPI (promover si
 * el CFDI sí se timbró, liberar si no hubo tal).
 */
import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { notifyInfo, notifySuccess } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";
import { recuperarClaimFactura, type RecuperarClaimResponse } from "@/features/facturacion/services/claimPending";
import { useQueryClient } from "@tanstack/react-query";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";

interface Props {
  facturaId: string;
  facturapiId: string | null;
  facturapiClaimAt: string | null;
}

const MENSAJES: Record<RecuperarClaimResponse["outcome"], { titulo: string; tono: "success" | "info" | "error" }> = {
  promovido: { titulo: "CFDI recuperado desde FacturAPI", tono: "success" },
  liberado: { titulo: "Reserva liberada, ya puedes reintentar el timbrado", tono: "success" },
  sin_cambios: { titulo: "Sin cambios", tono: "info" },
  too_early: { titulo: "Aún es pronto para recuperar", tono: "info" },
  no_pending: { titulo: "La factura ya no tiene reserva pendiente", tono: "info" },
  claim_perdido: { titulo: "La reserva cambió durante la recuperación", tono: "error" },
};

export function ClaimPendingBanner({ facturaId, facturapiId, facturapiClaimAt }: Props) {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  if (!facturapiId?.startsWith("PENDING:")) return null;

  const edadMs = facturapiClaimAt ? Date.now() - new Date(facturapiClaimAt).getTime() : 0;
  const edadMin = Math.floor(edadMs / 60_000);
  const puedeIntentar = edadMin >= 3;

  const onRecuperar = async () => {
    setLoading(true);
    try {
      const data = await recuperarClaimFactura(facturaId);
      const outcome = data?.outcome ?? "sin_cambios";
      const info = MENSAJES[outcome] ?? MENSAJES.sin_cambios;
      const description = data?.message;
      if (info.tono === "success") notifySuccess(undefined, { title: info.titulo, description });
      else if (info.tono === "error") {
        notifyError(undefined, {
          title: info.titulo,
          description,
          method: "ClaimPendingBanner.onRecuperar",
        });
      } else notifyInfo(undefined, { title: info.titulo, description });
      await qc.invalidateQueries({ queryKey: facturasKeys.detail(facturaId) });
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo recuperar el timbrado",
        error: err,
        method: "ClaimPendingBanner.onRecuperar",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Alert variant="destructive" className="border-warning bg-warning/10 text-warning-foreground">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Timbrado en proceso interrumpido</AlertTitle>
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Esta factura quedó reservada hace {edadMin} min sin confirmación de FacturAPI.
          {" "}Verifica si el CFDI se emitió y reconcilia el estado.
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onRecuperar}
          disabled={loading || !puedeIntentar}
          title={!puedeIntentar ? "Espera al menos 3 minutos desde el intento de timbrado." : undefined}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Verificar y recuperar
        </Button>
      </AlertDescription>
    </Alert>
  );
}
