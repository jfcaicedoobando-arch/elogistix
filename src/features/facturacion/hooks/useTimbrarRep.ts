/**
 * Hooks de timbrado / cancelación del REP (Complemento de Pagos).
 * v13.312.26 (QW2 Tanda 1) — al timbrar, se dispara auto-envío por correo al
 * contacto principal del cliente vía `facturapi-enviar-email` en modo
 * fire-and-forget: fallar el correo NO revierte el timbrado y sólo emite un
 * toast informativo.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { emitirRep, cancelarRep, type MotivoCancelacionSat } from "@/features/facturacion/services/repFacturapi";
import { autoEnviarRepPorCorreo } from "@/features/facturacion/services/repAutoEmail";
import { notifyError, notifyInfo } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";


export function useTimbrarRep(facturaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.emitirRep,
    mutationFn: (pagoId: string) => emitirRep(pagoId),
    onSuccess: (res, pagoId) => {
      notifySuccess(undefined, { title: `REP timbrado · UUID ${res.uuid.slice(0, 8)}…` });
      if (facturaId) {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagos(facturaId) });
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagosAll });
      }
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.repPendientes });
      invalidateProfitDependencies(qc);
      // Fire-and-forget: no bloquea la UI ni revierte el timbrado si falla.
      void autoEnviarRepPorCorreo(pagoId).catch((err: unknown) => {
        notifyInfo(undefined, {
          title: "REP timbrado, pero no se pudo auto-enviar por correo",
          description: err instanceof Error ? err.message : undefined,
        });
      });
    },
    onError: (err: Error) => notifyError(undefined, {
      // B-043: mensaje es-MX de negocio (antes se interpolaba el error crudo
      // del SDK, p. ej. "Failed to send a request to the Edge Function").
      title: "No se pudo timbrar el REP",
      description: getErrorMessage(err),
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
      notifySuccess(undefined, { title: "REP cancelado" });
      if (facturaId) {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagos(facturaId) });
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.facturas.pagosAll });
      }
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.repPendientes });
      invalidateProfitDependencies(qc);
    },
    onError: (err: Error) => notifyError(undefined, {
      title: "No se pudo cancelar el REP",
      description: getErrorMessage(err),
      error: err,
      method: "FEATURES_FACTURACION_HOOKS_USETIMBRARREP_2",
    }),

  });
}
