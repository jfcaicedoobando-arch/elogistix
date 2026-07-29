/**
 * Asignación de conceptos de venta pendientes a un borrador de proforma
 * (M14 Ola 1, antes inline en components/facturacion/ProformaInconsistenteAlert.tsx).
 * Unifica las invalidaciones de caché del embarque y sus proformas.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { asignarConceptosAProforma } from "@/features/proformas/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

interface Params {
  proformaId: string;
  proformaNumero: string;
  embarqueId: string;
  conceptoIds: string[];
}

export function useAsignarConceptosProforma({
  proformaId, proformaNumero, embarqueId, conceptoIds,
}: Params) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => asignarConceptosAProforma(proformaId, conceptoIds),
    onSuccess: () => {
      notifySuccess(undefined, { title: `Conceptos asignados a ${proformaNumero}` });
      // A8: la key viva de proformas por embarque vive en el factory de proformas.
      qc.invalidateQueries({ queryKey: queryKeys.proformas.embarque(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVenta(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.single(embarqueId) });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      notifyError(undefined, {
        title: `No se pudieron asignar los conceptos: ${msg}`,
        error: err,
        method: "FEATURES_EMBARQUES_COMPONENTS_FACTURACION_PROFORMAINCONSISTENTEALERT_1",
      });
    },
  });
}
