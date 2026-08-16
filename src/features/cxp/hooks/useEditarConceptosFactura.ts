/**
 * Mutación para reemplazar los conceptos de una factura de proveedor capturada
 * a mano (v13.628.0). Invalida el desglose y la factura, ya que la edición
 * puede regresar la factura a "por aprobar".
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  reemplazarConceptosFactura,
  type ReemplazarConceptosParams,
} from "../services/conceptosFacturaEditar";

export function useEditarConceptosFactura(facturaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Omit<ReemplazarConceptosParams, "facturaId">) =>
      reemplazarConceptosFactura({ ...params, facturaId }),
    onSuccess: (total) => {
      void qc.invalidateQueries({ queryKey: queryKeys.cxp.conceptosCfdi(facturaId) });
      void qc.invalidateQueries({ queryKey: queryKeys.cxp.factura(facturaId) });
      void qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      notifySuccess(undefined, {
        title: `Conceptos actualizados (${total})`,
        description: "Si la factura estaba aprobada, regresó a “Por aprobar”.",
      });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: "No se pudieron guardar los conceptos",
        description: error.message,
        error,
      });
    },
  });
}
