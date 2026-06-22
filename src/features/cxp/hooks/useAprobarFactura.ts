import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { aprobarFacturaProveedor } from "@/features/cxp/services/aprobacionFactura";
import { queryKeys } from "@/lib/query";

export function useAprobarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, aprobar, motivo }: { id: string; aprobar: boolean; motivo?: string }) =>
      aprobarFacturaProveedor(id, aprobar, motivo),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      toast.success(vars.aprobar ? "Factura aprobada" : "Factura rechazada");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la factura");
    },
  });
}
