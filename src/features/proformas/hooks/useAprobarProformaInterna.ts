/**
 * v13.624.0 — Aprobación interna de proforma para clientes de casa.
 *
 * Llama la RPC `aceptar_proforma_sin_autorizacion`, que valida en base de datos
 * que el cliente realmente no requiera autorización.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aceptarProformaSinAutorizacion } from "@/features/proformas/services/respuestaCliente";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

export function useAprobarProformaInterna() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (proformaId: string) => aceptarProformaSinAutorizacion(proformaId),
    onSuccess: () => {
      // `proformas.all` cubre listas y detalle; no existe query con root ["proforma"].
      void qc.invalidateQueries({ queryKey: queryKeys.proformas.all });
      notifySuccess(undefined, {
        title: "Proforma aprobada internamente",
        description: "El cliente no requiere autorización; ya puedes convertirla a factura.",
      });
    },
    onError: (err: unknown) => {
      notifyError(undefined, {
        title: "No se pudo aprobar la proforma",
        description: getErrorMessage(err),
        error: err,
        method: "APROBAR_PROFORMA_INTERNA",
      });
    },
  });

  return { aprobar: mutation.mutate, isPending: mutation.isPending };
}
