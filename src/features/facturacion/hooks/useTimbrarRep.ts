/**
 * Hooks de timbrado / cancelación del REP (Complemento de Pagos).
 * v13.91.0
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { emitirRep, cancelarRep, type MotivoCancelacionSat } from "@/features/facturacion/services/repFacturapi";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { queryKeys } from "@/lib/query";

export function useTimbrarRep(facturaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.emitirRep,
    mutationFn: (pagoId: string) => emitirRep(pagoId),
    onSuccess: (res) => {
      toast.success(`REP timbrado · UUID ${res.uuid.slice(0, 8)}…`);
      if (facturaId) {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagos(facturaId) });
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagosAll });
      }
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.repPendientes });
    },
    onError: (err: Error) => notifyError(toast, {
      title: `No se pudo timbrar el REP: ${err.message}`,
      error: err,
      method: "FEATURES_FACTURACION_HOOKS_USETIMBRARREP_1",
    }),
  });
}

export function useCancelarRep(facturaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.cancelarRep,
    mutationFn: (vars: { pagoId: string; motivo: MotivoCancelacionSat; sustituyeUuid?: string }) =>
      cancelarRep(vars.pagoId, vars.motivo, vars.sustituyeUuid),
    onSuccess: () => {
      toast.success("REP cancelado");
      if (facturaId) {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagos(facturaId) });
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagosAll });
      }
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.repPendientes });
    },
    onError: (err: Error) => notifyError(toast, {
      title: `No se pudo cancelar el REP: ${err.message}`,
      error: err,
      method: "FEATURES_FACTURACION_HOOKS_USETIMBRARREP_2",
    }),
  });
}
