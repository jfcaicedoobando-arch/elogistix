/**
 * Hooks de timbrado / cancelación del REP (Complemento de Pagos).
 * v13.91.0
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { emitirRep, cancelarRep, type MotivoCancelacionSat } from "@/features/facturacion/services/repFacturapi";
import { notifyError } from "@/components/shared/utils/appFeedback";

export function useTimbrarRep(facturaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pagoId: string) => emitirRep(pagoId),
    onSuccess: (res) => {
      toast.success(`REP timbrado · UUID ${res.uuid.slice(0, 8)}…`);
      if (facturaId) {
        qc.invalidateQueries({ queryKey: ["pagos_factura", facturaId] });
      } else {
        qc.invalidateQueries({ queryKey: ["pagos_factura"] });
      }
      qc.invalidateQueries({ queryKey: ["rep_pendientes"] });
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
    mutationFn: (vars: { pagoId: string; motivo: MotivoCancelacionSat; sustituyeUuid?: string }) =>
      cancelarRep(vars.pagoId, vars.motivo, vars.sustituyeUuid),
    onSuccess: () => {
      toast.success("REP cancelado");
      if (facturaId) {
        qc.invalidateQueries({ queryKey: ["pagos_factura", facturaId] });
      } else {
        qc.invalidateQueries({ queryKey: ["pagos_factura"] });
      }
      qc.invalidateQueries({ queryKey: ["rep_pendientes"] });
    },
    onError: (err: Error) => notifyError(toast, {
      title: `No se pudo cancelar el REP: ${err.message}`,
      error: err,
      method: "FEATURES_FACTURACION_HOOKS_USETIMBRARREP_2",
    }),
  });
}
