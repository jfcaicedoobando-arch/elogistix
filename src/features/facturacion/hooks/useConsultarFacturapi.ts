/**
 * useConsultarFacturapi — mutation que dispara `facturapi-consultar` para ver
 * en vivo qué reporta FacturApi/SAT sobre una factura y reconciliar BD.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { consultarEstadoFacturapi, type ConsultarFacturapiResult } from "@/features/facturacion/services/facturapi";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

export function useConsultarFacturapi(facturaId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation<ConsultarFacturapiResult, Error, void>({
    mutationFn: () => {
      if (!facturaId) throw new Error("factura_id requerido");
      return consultarEstadoFacturapi(facturaId);
    },
    onSuccess: (res) => {
      if (res.reconciliada) {
        notifySuccess(toast, {
          title: "Estado reconciliado",
          description: "FacturApi reportó un estado distinto al local. Se actualizó la factura.",
        });
        qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(facturaId ?? undefined) });
        qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
      }
    },
    onError: (err) =>
      notifyError(toast, {
        title: "No se pudo consultar FacturApi",
        description: err.message,
      }),
  });
}
