/**
 * Mutations de cambio de estado del embarque: avanzar, sync directo y reabrir.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  actualizarEstadoEmbarque,
  avanzarEstadoEmbarqueRpc,
  reabrirEmbarqueRpc,
  insertEventoEmbarque,
} from '@/features/embarques/services';
import {
  tipoEventoParaEstado,
  descripcionEventoCambioEstado,
} from '@/features/embarques/domain/embarque';
import { newRequestId } from '@/lib/idempotency';
import { notifyError } from '@/components/shared/utils/appFeedback';

async function insertarEventoTracking(embarqueId: string, nuevoEstado: string, usuario: string) {
  await insertEventoEmbarque({
    embarqueId,
    tipo: tipoEventoParaEstado(nuevoEstado),
    descripcion: descripcionEventoCambioEstado(nuevoEstado),
    ubicacion: '',
    fecha: new Date().toISOString(),
    usuario,
  });
}

export function useAvanzarEstadoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, nuevoEstado, usuarioEmail, requestId }: { embarqueId: string; nuevoEstado: string; usuarioEmail: string; requestId?: string }) => {
      await avanzarEstadoEmbarqueRpc({
        embarqueId,
        nuevoEstado,
        usuarioEmail,
        tipoEvento: tipoEventoParaEstado(nuevoEstado),
        descripcionEvento: descripcionEventoCambioEstado(nuevoEstado),
        requestId: requestId ?? newRequestId(),
      });
    },
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.notas(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
    },
    // Toasts (éxito y error) los maneja el caller (useEmbarqueEstadoActions)
    // para evitar doble notificación y poder clasificar mensajes (docs_faltantes, etc.).
    onError: () => {
      // No-op intencional: el caller (useEmbarqueEstadoActions) clasifica y notifica el error.
    },
  });
}

export function useSyncEstadoEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, nuevoEstado, usuarioEmail }: { embarqueId: string; nuevoEstado: string; usuarioEmail?: string }) => {
      await actualizarEstadoEmbarque(embarqueId, nuevoEstado);
      await insertarEventoTracking(embarqueId, nuevoEstado, usuarioEmail && usuarioEmail.trim() ? usuarioEmail : 'sistema');
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al sincronizar estado: ${error.message}`, error, method: "SYNC_EMBARQUE_STATE" });
    },
  });
}

/**
 * Reabre un embarque cerrado (Cerrado → Entregado). Solo admin/super_admin.
 * El backend valida el rol y rechaza si el estado actual no es Cerrado.
 */
export function useReabrirEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, usuarioEmail, requestId }: { embarqueId: string; usuarioEmail: string; requestId?: string }) => {
      await reabrirEmbarqueRpc({
        embarqueId,
        usuarioEmail,
        requestId: requestId ?? newRequestId(),
      });
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.notas(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
    },
    // Toasts (éxito y error) manejados por el caller para evitar doble notificación.
    onError: () => {
      // No-op intencional: el caller maneja el toast de error.
    },
  });
}
