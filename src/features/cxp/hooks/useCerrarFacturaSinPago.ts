import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cerrarFacturaProveedorSinPago,
  type MotivoCierreSinPago,
} from "@/features/cxp/services/cerrarFacturaSinPago";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

/**
 * Hook para cerrar una factura de proveedor sin pago real (compensación, quita,
 * ajuste histórico, duplicada). Refresca listados CxP y aging.
 *
 * v13.204.0 · Ola A · A4
 */
export function useCerrarFacturaProveedorSinPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cxp", "cerrar-sin-pago"],
    mutationFn: (p: {
      facturaId: string;
      motivo: MotivoCierreSinPago;
      comentario?: string;
    }) => cerrarFacturaProveedorSinPago(p),
    onSuccess: () => {
      notifySuccess(toast, {
        title: "Factura cerrada sin pago",
        description:
          "Se registró un ajuste y la factura quedó marcada como pagada. Aparece en el histórico con el motivo indicado.",
      });
      qc.invalidateQueries({ queryKey: ["cxp"] });
      qc.invalidateQueries({ queryKey: ["proveedor-facturas"] });
      qc.invalidateQueries({ queryKey: ["cxp-aging"] });
      qc.invalidateQueries({ queryKey: ["bandeja"] });
    },
    onError: (err: Error) =>
      notifyError(toast, {
        title: `No se pudo cerrar la factura: ${err.message}`,
        error: err,
        method: "FEATURES_CXP_HOOKS_USECERRARFACTURASINPAGO",
      }),
  });
}
