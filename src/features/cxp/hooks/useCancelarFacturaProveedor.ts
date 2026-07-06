import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cancelarFacturaProveedor } from "@/features/cxp/services/cancelarFacturaProveedor";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

/**
 * Hook para cancelar una factura de proveedor.
 * Refresca CxP, notas de crédito y conceptos de costo (auto-liquidación).
 * v13.189.0 · Ola 2 · Item 4
 */
export function useCancelarFacturaProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cxp", "cancelar-factura"],
    mutationFn: (p: { facturaId: string; motivo: string }) =>
      cancelarFacturaProveedor(p.facturaId, p.motivo),
    onSuccess: () => {
      notifySuccess(toast, {
        title: "Factura cancelada",
        description: "Se cancelaron las notas de crédito asociadas y se limpiaron los conceptos del embarque.",
      });
      qc.invalidateQueries({ queryKey: ["cxp"] });
      qc.invalidateQueries({ queryKey: ["proveedor-facturas"] });
      qc.invalidateQueries({ queryKey: ["proveedor-notas-credito"] });
      qc.invalidateQueries({ queryKey: ["conceptos-costo"] });
      qc.invalidateQueries({ queryKey: ["embarque"] });
    },
    onError: (err: Error) =>
      notifyError(toast, {
        title: `No se pudo cancelar la factura: ${err.message}`,
        error: err,
        method: "FEATURES_CXP_HOOKS_USECANCELARFACTURAPROVEEDOR",
      }),
  });
}
