import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { aprobarFacturaProveedor } from "@/features/cxp/services/aprobacionFactura";
import { queryKeys } from "@/lib/query";

export function useAprobarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, aprobar, motivo }: { id: string; aprobar: boolean; motivo?: string }) =>
      aprobarFacturaProveedor(id, aprobar, motivo),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: ["cxp", "pendientes-aprobacion-count"] });
      notifySuccess(undefined, { title: vars.aprobar ? "Factura aprobada" : "Factura rechazada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `No se pudo actualizar la factura: ${error.message}`,
        error,
        method: "APROBAR_FACTURA_PROVEEDOR",
      });
    },
  });
}
