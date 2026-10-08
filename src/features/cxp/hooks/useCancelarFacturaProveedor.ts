import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelarFacturaProveedor } from "@/features/cxp/services/cancelarFacturaProveedor";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import { invalidateSeguroFacturaDependencies } from "@/lib/query/invalidateSeguroFacturaDependencies";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";
import { getErrorMessage } from "@/lib/errors";

/**
 * Hook para cancelar una factura de proveedor.
 * Refresca CxP, notas de crédito y conceptos de costo (auto-liquidación).
 * v13.189.0 · Ola 2 · Item 4
 */
export function useCancelarFacturaProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.cxp.all,
    mutationFn: (p: { facturaId: string; motivo: string }) =>
      cancelarFacturaProveedor(p.facturaId, p.motivo),
    onSuccess: () => {
      void invalidateSeguroFacturaDependencies(qc);
      notifySuccess(undefined, {
        title: "Registro de factura de proveedor cancelado",
        description: "Se cancelaron los registros de notas de crédito asociados y se recalculó la liquidación de los costos del embarque. No se solicitó cancelación ante el SAT.",
      });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.proveedorFacturas.all });
      qc.invalidateQueries({ queryKey: queryKeys.proveedorNotasCredito.all });
      qc.invalidateQueries({ queryKey: queryKeys.conceptosCosto.all });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.all });
      invalidateProfitDependencies(qc);
    },
    onError: (err: Error) =>
      notifyError(undefined, {
        title: "No se pudo cancelar la factura", description: getErrorMessage(err),
        error: err,
        method: "FEATURES_CXP_HOOKS_USECANCELARFACTURAPROVEEDOR",
      }),
  });
}
