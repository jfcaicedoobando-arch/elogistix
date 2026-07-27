import { useMutation, useQueryClient } from "@tanstack/react-query";
import { programarPagoProveedor } from "@/features/cxp/services/programarPagoProveedor";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";

/**
 * Hook para programar (o desprogramar) el pago de una factura de proveedor.
 * Refresca la lista de CxP al terminar. v13.188.0
 */
export function useProgramarPagoProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.cxp.all,
    mutationFn: (p: { facturaId: string; fecha: string | null }) =>
      programarPagoProveedor(p.facturaId, p.fecha),
    onSuccess: (_r, vars) => {
      notifySuccess(undefined, {
        title: vars.fecha ? `Pago programado para ${vars.fecha}` : "Programación de pago cancelada",
      });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.proveedorFacturas.all });
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      invalidateProfitDependencies(qc);
    },
    onError: (err: Error) =>
      notifyError(undefined, {
        title: `No se pudo programar el pago: ${err.message}`,
        error: err,
        method: "FEATURES_CXP_HOOKS_USEPROGRAMARPAGOPROVEEDOR",
      }),
  });
}
