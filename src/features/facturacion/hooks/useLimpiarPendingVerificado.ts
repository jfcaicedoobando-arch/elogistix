/**
 * useLimpiarPendingVerificado — invoca el RPC
 * `limpiar_cancellation_status_verificado` para borrar manualmente el flag
 * `cancellation_status = 'pending'` de una factura cuando la consulta en vivo
 * a FacturAPI confirmó que ya no hay solicitud de cancelación abierta.
 *
 * El RPC valida rol y precondiciones; aquí solo pasamos `factura_id` y el
 * `cancellation_status` remoto que devolvió `facturapi-consultar`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { limpiarCancellationStatusVerificado } from "@/features/facturacion/services/limpiarPendingVerificado";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

interface Args {
  facturaId: string;
  remoteCancellationStatus: string;
}

export function useLimpiarPendingVerificado(facturaId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation<void, Error, Args>({
    mutationFn: ({ facturaId: id, remoteCancellationStatus }) =>
      limpiarCancellationStatusVerificado({ facturaId: id, remoteCancellationStatus }),
    onSuccess: () => {
      notifySuccess(undefined, {
        title: "Estado local limpiado",
        description: "La factura vuelve a mostrarse como Emitida. FacturAPI confirmó que no hay cancelación en curso.",
      });
      qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(facturaId ?? undefined) });
      qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
    },
    onError: (err) =>
      notifyError(undefined, {
        title: "No se pudo limpiar el estado",
        description: err.message,
      }),
  });
}
