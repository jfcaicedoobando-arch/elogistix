/**
 * useEliminarBorradorFactura — mutación para eliminar un borrador de factura.
 * La RPC da de baja el borrador y libera sólo las proformas sin otra
 * factura activa. La aceptación del cliente se conserva.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/shared/useToast";
import { notifyError } from "@/lib/ui/appFeedback";
import { eliminarFacturaBorrador } from "@/features/facturacion/services/eliminarBorrador";
import { queryKeys } from "@/lib/query";
import { invalidateHuecoFacturacion } from "@/features/facturacion/hooks/invalidateHuecoFacturacion";

export function useEliminarBorradorFactura() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationKey: queryKeys.facturacion.eliminarBorrador,
    mutationFn: (facturaId: string) => eliminarFacturaBorrador(facturaId),
    onSuccess: () => {
      toast({
        title: "Borrador eliminado",
        description: "Se dio de baja el borrador. Las proformas sin otra factura activa quedaron disponibles para convertir.",
      });
      qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
      qc.invalidateQueries({ queryKey: queryKeys.proformas.all });
      // A8: ['proforma-detalle'] estaba muerta; la raíz viva es proformas.all
      // (ya invalidada arriba) más el detalle por embarque cuando aplica.
      invalidateHuecoFacturacion(qc);
      navigate("/facturacion");
    },
    onError: (err) =>
      notifyError(undefined, { error: err, title: "Eliminar borrador de factura" }),
  });

  return {
    eliminar: mutation.mutate,
    isPending: mutation.isPending,
  };
}
