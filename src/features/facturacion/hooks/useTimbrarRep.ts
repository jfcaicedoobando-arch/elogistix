/**
 * Hooks de timbrado / cancelación del REP (Complemento de Pagos).
 * v13.312.26 (QW2 Tanda 1) — al timbrar, se dispara auto-envío por correo al
 * contacto principal del cliente vía `facturapi-enviar-email` en modo
 * fire-and-forget: fallar el correo NO revierte el timbrado y sólo emite un
 * toast informativo.
 * v13.549.0 — si el pago ya tenía REP (409 `ya_timbrado_rep`) no es un error
 * del usuario: se avisa en tono informativo y se refresca la pantalla, que era
 * justo lo que estaba desactualizado.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySuccess } from "@/lib/ui/appFeedback";
import {
  emitirRep,
  cancelarRep,
  esRepYaTimbrado,
  type MotivoCancelacionSat,
} from "@/features/facturacion/services/repFacturapi";
import { autoEnviarRepPorCorreo } from "@/features/facturacion/services/repAutoEmail";
import { notifyError, notifyInfo } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { invalidarTrasRep } from "./invalidarRep";
import { tituloTimbrado } from "@/features/facturacion/utils/uuidCorto";


export function useTimbrarRep(facturaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.emitirRep,
    mutationFn: (pagoId: string) => emitirRep(pagoId),
    onSuccess: (res, pagoId) => {
      notifySuccess(undefined, { title: tituloTimbrado("REP timbrado", res.uuid) });
      invalidarTrasRep(qc, facturaId);
      // Fire-and-forget: no bloquea la UI ni revierte el timbrado si falla.
      void autoEnviarRepPorCorreo(pagoId).catch((err: unknown) => {
        notifyInfo(undefined, {
          title: "REP timbrado, pero no se pudo auto-enviar por correo",
          description: getErrorMessage(err),
        });
      });
    },
    onError: (err: Error) => {
      if (esRepYaTimbrado(err)) {
        // La pantalla estaba desactualizada: refrescar y avisar sin alarma.
        invalidarTrasRep(qc, facturaId);
        notifyInfo(undefined, {
          title: "Este pago ya tenía su REP timbrado",
          description: `${getErrorMessage(err)} Se actualizó la pantalla con el folio real.`,
        });
        return;
      }
      notifyError(undefined, {
        // B-043: mensaje es-MX de negocio (antes se interpolaba el error crudo
        // del SDK, p. ej. "Failed to send a request to the Edge Function").
        title: "No se pudo timbrar el REP",
        description: getErrorMessage(err),
        error: err,
        method: "FEATURES_FACTURACION_HOOKS_USETIMBRARREP_1",
      });
    },
  });
}

export function useCancelarRep(facturaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.facturacion.cancelarRep,
    mutationFn: (vars: { pagoId: string; motivo: MotivoCancelacionSat; sustituyeUuid?: string }) =>
      cancelarRep(vars.pagoId, vars.motivo, vars.sustituyeUuid),
    onSuccess: (resultado) => {
      if (resultado.uncertain) {
        // v13.821.6 (P1-2) — timeout con `verifying` persistido: éxito
        // informativo, NO se ofrece reintentar (reenviar la cancelación con
        // resultado incierto es inseguro); "Actualizar estado" resuelve.
        notifyInfo(undefined, {
          title: "Cancelación del REP enviada · verificando",
          description: resultado.message
            ?? "La solicitud fue enviada, pero FacturApi tardó en confirmar. Estamos verificando el estado; no vuelvas a cancelarlo.",
          duration: 15000,
        });
      } else if (resultado.pending || ["pending", "verifying"].includes(resultado.cancellation_status)) {
        notifyInfo(undefined, {
          title: "Solicitud de cancelación enviada",
          description: resultado.message ?? "El SAT está verificando la cancelación del REP.",
        });
      } else {
        notifySuccess(undefined, { title: "REP cancelado" });
      }
      invalidarTrasRep(qc, facturaId);
    },
    onError: (err: Error) => notifyError(undefined, {
      title: "No se pudo cancelar el REP",
      description: getErrorMessage(err),
      error: err,
      method: "FEATURES_FACTURACION_HOOKS_USETIMBRARREP_2",
    }),

  });
}
