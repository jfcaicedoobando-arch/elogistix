import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { verificarUuidSat, type EstatusSat } from "@/features/cxp/services/verificarUuidSat";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

/**
 * Hook para verificar el UUID de una factura de proveedor contra el SAT.
 * Refresca la lista de CxP al terminar.
 * v13.187.0
 */
export function useVerificarUuidSat() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.cxp.all,
    mutationFn: (facturaId: string) => verificarUuidSat(facturaId),
    onSuccess: (res: { estatus: EstatusSat }) => {
      if (res.estatus === "Vigente") notifySuccess(undefined, { title: "CFDI Vigente en SAT" });
      else if (res.estatus === "Cancelado") notifyWarning(undefined, { title: "CFDI Cancelado en SAT" });
      else if (res.estatus === "No Encontrado")
        notifyError(undefined, {
          title: "CFDI No encontrado en SAT",
          method: "FEATURES_CXP_HOOKS_USEVERIFICARUUIDSAT",
        });
      else
        notifyError(undefined, {
          title: "SAT no devolvió un estatus válido",
          method: "FEATURES_CXP_HOOKS_USEVERIFICARUUIDSAT",
        });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.proveedorFacturas.all });
    },
    onError: (err: Error) =>
      notifyError(undefined, {
        title: `No se pudo consultar SAT: ${err.message}`,
        error: err,
        method: "FEATURES_CXP_HOOKS_USEVERIFICARUUIDSAT",
      }),
  });
}
