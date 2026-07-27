import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelarFacturaProveedor } from "@/features/cxp/services/cancelarFacturaProveedor";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";

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
      notifySuccess(undefined, {
        title: "Factura cancelada",
        description: "Se cancelaron las notas de crédito asociadas y se limpiaron los conceptos del embarque.",
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
        title: `No se pudo cancelar la factura: ${err.message}`,
        error: err,
        method: "FEATURES_CXP_HOOKS_USECANCELARFACTURAPROVEEDOR",
      }),
  });
}
