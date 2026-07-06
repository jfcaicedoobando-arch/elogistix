import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { programarPagoProveedor } from "@/features/cxp/services/programarPagoProveedor";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

/**
 * Hook para programar (o desprogramar) el pago de una factura de proveedor.
 * Refresca la lista de CxP al terminar. v13.188.0
 */
export function useProgramarPagoProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cxp", "programar-pago"],
    mutationFn: (p: { facturaId: string; fecha: string | null }) =>
      programarPagoProveedor(p.facturaId, p.fecha),
    onSuccess: (_r, vars) => {
      notifySuccess(toast, {
        title: vars.fecha ? `Pago programado para ${vars.fecha}` : "Programación de pago cancelada",
      });
      qc.invalidateQueries({ queryKey: ["cxp"] });
      qc.invalidateQueries({ queryKey: ["proveedor-facturas"] });
      qc.invalidateQueries({ queryKey: ["tesoreria"] });
    },
    onError: (err: Error) =>
      notifyError(toast, {
        title: `No se pudo programar el pago: ${err.message}`,
        error: err,
        method: "FEATURES_CXP_HOOKS_USEPROGRAMARPAGOPROVEEDOR",
      }),
  });
}
