import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { verificarUuidSat, type EstatusSat } from "@/features/cxp/services/verificarUuidSat";
import { notifyError } from "@/components/shared/utils/appFeedback";

/**
 * Hook para verificar el UUID de una factura de proveedor contra el SAT.
 * Refresca la lista de CxP al terminar.
 * v13.187.0
 */
export function useVerificarUuidSat() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cxp", "verificar-uuid-sat"],
    mutationFn: (facturaId: string) => verificarUuidSat(facturaId),
    onSuccess: (res: { estatus: EstatusSat }) => {
      if (res.estatus === "Vigente") toast.success("CFDI Vigente en SAT");
      else if (res.estatus === "Cancelado") toast.warning("CFDI Cancelado en SAT");
      else if (res.estatus === "No Encontrado") toast.error("CFDI No encontrado en SAT");
      else toast.error("SAT no devolvió un estatus válido");
      qc.invalidateQueries({ queryKey: ["cxp"] });
      qc.invalidateQueries({ queryKey: ["proveedor-facturas"] });
    },
    onError: (err: Error) =>
      notifyError(toast, {
        title: `No se pudo consultar SAT: ${err.message}`,
        error: err,
        method: "FEATURES_CXP_HOOKS_USEVERIFICARUUIDSAT",
      }),
  });
}
