import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cerrarFacturaProveedorSinPago,
  type MotivoCierreSinPago,
} from "@/features/cxp/services/cerrarFacturaSinPago";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

/**
 * Hook para cerrar una factura de proveedor sin pago real (compensación, quita,
 * ajuste histórico, duplicada). Refresca listados CxP y aging.
 *
 * v13.204.0 · Ola A · A4
 */
export function useCerrarFacturaProveedorSinPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.cxp.all,
    mutationFn: (p: {
      facturaId: string;
      motivo: MotivoCierreSinPago;
      comentario?: string;
    }) => cerrarFacturaProveedorSinPago(p),
    onSuccess: () => {
      notifySuccess(undefined, {
        title: "Factura cerrada sin pago",
        description:
          "Se registró un ajuste y la factura quedó marcada como pagada. Aparece en el histórico con el motivo indicado.",
      });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.proveedorFacturas.all });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.aging() });
      qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });
    },
    onError: (err: Error) => {
      // Fase M (v13.301.84): mapeo dedicado para el gate de rol.
      if (err.message?.includes("LC_CERRAR_FACTURA_SIN_ROL")) {
        notifyError(undefined, {
          title: "No tienes permiso para cerrar esta factura",
          description:
            "Sólo Contabilidad, Tesorería o un administrador pueden cerrar facturas de proveedor sin registrar un pago real.",
          error: err,
          method: "FEATURES_CXP_HOOKS_USECERRARFACTURASINPAGO",
        });
        return;
      }
      notifyError(undefined, {
        title: `No se pudo cerrar la factura: ${err.message}`,
        error: err,
        method: "FEATURES_CXP_HOOKS_USECERRARFACTURASINPAGO",
      });
    },
  });
}
