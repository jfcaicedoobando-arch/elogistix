/**
 * useEliminarBorradorFactura — mutación para eliminar un borrador de factura.
 * Al eliminar el borrador, el RPC revierte las proformas ligadas al estado
 * previo (aceptadas por cliente, sin `factura_id`) para poder re-convertirlas.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/shared/useToast";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { eliminarFacturaBorrador } from "@/features/facturacion/services/eliminarBorrador";

export function useEliminarBorradorFactura() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationKey: ["fiscal", "eliminar-borrador"],
    mutationFn: (facturaId: string) => eliminarFacturaBorrador(facturaId),
    onSuccess: () => {
      toast({
        title: "Borrador eliminado",
        description: "La proforma volvió a estar disponible para convertir.",
      });
      qc.invalidateQueries({ queryKey: ["facturas"] });
      qc.invalidateQueries({ queryKey: ["proformas"] });
      qc.invalidateQueries({ queryKey: ["proforma-detalle"] });
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
