import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/components/shared/utils/appFeedback";
import {
  timbrarNotaCreditoFacturapi,
  cancelarNotaCreditoFacturapi,
} from "@/features/facturacion/services/notasCreditoFacturapi";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import { queryKeys } from "@/lib/query";

export function useTimbrarNotaCredito(facturaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.emitirNotaCredito,
    mutationFn: (notaCreditoId: string) => timbrarNotaCreditoFacturapi(notaCreditoId),
    onSuccess: (res) => {
      toast.success(`Nota de crédito timbrada · UUID ${res.uuid.slice(0, 8)}…`);
      qc.invalidateQueries({ queryKey: facturasKeys.notasCredito(facturaId) });
      qc.invalidateQueries({ queryKey: facturasKeys.notasCreditoRecientes() });
    },
    onError: (err: Error) =>
      notifyError(toast, {
        title: `No se pudo timbrar la nota de crédito: ${err.message}`,
        error: err,
        method: "FEATURES_FACTURACION_HOOKS_USENOTACREDITOFACTURAPI_1",
      }),
  });
}

export function useCancelarNotaCredito(facturaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.cancelarNotaCredito,
    mutationFn: (vars: { notaCreditoId: string; motivo: MotivoCancelacionSat; sustituyeUuid?: string }) =>
      cancelarNotaCreditoFacturapi(vars.notaCreditoId, vars.motivo, vars.sustituyeUuid),
    onSuccess: () => {
      toast.success("Nota de crédito cancelada");
      qc.invalidateQueries({ queryKey: facturasKeys.notasCredito(facturaId) });
      qc.invalidateQueries({ queryKey: facturasKeys.notasCreditoRecientes() });
    },
    onError: (err: Error) =>
      notifyError(toast, {
        title: `No se pudo cancelar la nota de crédito: ${err.message}`,
        error: err,
        method: "FEATURES_FACTURACION_HOOKS_USENOTACREDITOFACTURAPI_2",
      }),
  });
}
