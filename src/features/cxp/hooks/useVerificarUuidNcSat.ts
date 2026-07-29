/**
 * Hook para verificar el UUID de una nota de crédito de proveedor contra el SAT.
 * Refresca la lista de NCs de la factura padre al terminar.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { verificarUuidNcSat, type EstatusSat } from "@/features/cxp/services/verificarUuidNcSat";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import { notificarNoVerificable } from "./satNoVerificable";

export function useVerificarUuidNcSat(facturaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.cxp.notasCredito(facturaId ?? ""),
    mutationFn: (ncId: string) => verificarUuidNcSat(ncId),
    onSuccess: (res: { estatus: EstatusSat }) => {
      if (res.estatus === "Vigente") notifySuccess(undefined, { title: "CFDI Vigente en SAT" });
      else if (res.estatus === "Cancelado") notifyWarning(undefined, { title: "CFDI Cancelado en SAT" });
      else if (res.estatus === "No verificable") notificarNoVerificable();
      else if (res.estatus === "No Encontrado")
        notifyError(undefined, { title: "CFDI No encontrado en SAT", method: "USE_VERIFICAR_UUID_NC_SAT" });
      else
        notifyError(undefined, { title: "SAT no devolvió un estatus válido", method: "USE_VERIFICAR_UUID_NC_SAT" });
      if (facturaId) qc.invalidateQueries({ queryKey: queryKeys.cxp.notasCredito(facturaId) });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
    },
    onError: (err: Error) =>
      notifyError(undefined, {
        title: `No se pudo consultar SAT: ${err.message}`,
        error: err,
        method: "USE_VERIFICAR_UUID_NC_SAT",
      }),
  });
}
