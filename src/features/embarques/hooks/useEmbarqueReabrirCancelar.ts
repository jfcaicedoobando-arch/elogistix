import { useCallback } from "react";
import { useRegistrarActividad } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import {
  useAvanzarEstadoEmbarque,
  useReabrirEmbarque,
  type EmbarqueRow,
} from "@/features/embarques/hooks/useEmbarques";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { useStableRequestId } from "@/lib/idempotency";

/**
 * Handlers de "Reabrir" y "Cancelar" para el detalle de embarque.
 * Extraído de useEmbarqueEstadoActions para respetar límite de 200 líneas.
 */
export function useEmbarqueReabrirCancelar(
  embarque: EmbarqueRow | undefined,
  id: string | undefined,
  usuarioEmail: string,
) {
  const registrarActividad = useRegistrarActividad();
  const avanzarEstado = useAvanzarEstadoEmbarque();
  const reabrirEmbarque = useReabrirEmbarque();
  // O1.11: una llave por intento, estable ante reintentos de red y renovada
  // sólo tras éxito. Evita reabrir/cancelar dos veces el mismo embarque.
  const reqIdReabrir = useStableRequestId();
  const reqIdCancelar = useStableRequestId();

  const handleReabrir = useCallback(async (motivo: string) => {
    if (!embarque || !id) return;
    try {
      const resultado = await reabrirEmbarque.mutateAsync({
        embarqueId: id,
        usuarioEmail,
        motivo,
        requestId: reqIdReabrir.get(),
      });
      // v13.823.47 — `pendiente` = otro request con la MISMA llave está
      // ejecutando la reapertura. No es éxito: no se resetea la llave (para
      // reintentar con ella), no se escribe bitácora y se avisa al usuario.
      if (resultado.pendiente) {
        notifyWarning(undefined, {
          title: "Reapertura en proceso",
          description: "La solicitud anterior aún se está procesando. Espera unos segundos y vuelve a intentar.",
        });
        return;
      }
      reqIdReabrir.reset();
      if (!resultado.replay) {
        registrarActividad.mutate({
          accion: "reabrir_embarque",
          modulo: "embarques",
          entidad_id: id,
          entidad_nombre: labelExpediente(embarque.expediente, embarque.id),
          detalles: { estado_anterior: "Cerrado", estado_nuevo: "Entregado", motivo },
        });
      }

      notifySuccess(undefined, {
        title: "Embarque reabierto",
        description: "Ahora puedes generar la proforma o ajustar facturación.",
      });

    } catch (err: unknown) {
      notifyError(undefined, {
        title: "Error al reabrir embarque",
        description: getErrorMessage(err),
        error: err,
        method: "HANDLE_REABRIR_EMBARQUE",
      });
    }
  }, [embarque, id, reabrirEmbarque, usuarioEmail, registrarActividad, reqIdReabrir]);

  const handleCancelar = useCallback(
    async (motivo: string) => {
      if (!embarque || !id) return;
      try {
        await avanzarEstado.mutateAsync({
          embarqueId: id,
          nuevoEstado: "Cancelado",
          usuarioEmail,
          requestId: reqIdCancelar.get(),
        });
        reqIdCancelar.reset();
        registrarActividad.mutate({
          accion: "cancelar_embarque",
          modulo: "embarques",
          entidad_id: id,
          entidad_nombre: labelExpediente(embarque.expediente, embarque.id),
          detalles: { estado_anterior: embarque.estado, motivo },
        });
        notifySuccess(undefined, { title: "Embarque cancelado", description: motivo });
      } catch (err: unknown) {
        notifyError(undefined, {
          title: "No se pudo cancelar el embarque",
          description: getErrorMessage(err),
          error: err,
          method: "HANDLE_CANCELAR_EMBARQUE",
        });
      }
    },
    [embarque, id, avanzarEstado, usuarioEmail, registrarActividad, reqIdCancelar],
  );

  return { handleReabrir, reabrirEmbarque, handleCancelar };
}
