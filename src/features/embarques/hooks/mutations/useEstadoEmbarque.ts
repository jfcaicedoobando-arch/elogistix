/**
 * Mutations de cambio de estado del embarque: avanzar, sync directo y reabrir.
 * v13.278.0 · `useSyncEstadoEmbarque` ahora escribe el estado en caché de forma
 * optimista (detail + full) con rollback automático si la mutación falla.
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

import { useMutationWithFeedback } from '@/hooks/shared/useMutationWithFeedback';

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
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
    },
    // Toasts (éxito y error) los maneja el caller (useEmbarqueEstadoActions)
    // para evitar doble notificación y poder clasificar mensajes (docs_faltantes, etc.).
    onError: () => {
      // No-op intencional: el caller (useEmbarqueEstadoActions) clasifica y notifica el error.
    },
  });
}

interface SyncEstadoInput {
  embarqueId: string;
  nuevoEstado: string;
  usuarioEmail?: string;
}

// SAFE-CAST: parcheamos únicamente el campo `estado` en el objeto cacheado.
const patchEstado = (old: unknown, vars: SyncEstadoInput) => {
  if (!old || typeof old !== "object") return old;
  return { ...(old as Record<string, unknown>), estado: vars.nuevoEstado };
};

export function useSyncEstadoEmbarque() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback<void, Error, SyncEstadoInput>({
    mutationFn: async ({ embarqueId, nuevoEstado, usuarioEmail }: SyncEstadoInput) => {
      // v13.309.2 — La traducción de `LC_TRANSICION_INVALIDA` (y demás
      // códigos LC_*) vive ahora en `src/lib/errors/lcCodes.ts` y la aplica
      // `getErrorMessage` en el wrapper `useMutationWithFeedback`.
      await actualizarEstadoEmbarque(embarqueId, nuevoEstado);
      await insertarEventoTracking(
        embarqueId,
        nuevoEstado,
        usuarioEmail && usuarioEmail.trim() ? usuarioEmail : 'sistema',
      );
    },
    invalidate: [queryKeys.embarques.all, queryKeys.auditoria.embarques],
    optimistic: [
      { queryKey: (v) => queryKeys.embarques.detail(v.embarqueId), updater: patchEstado },
      { queryKey: (v) => queryKeys.embarques.full(v.embarqueId), updater: patchEstado },
    ],
    // Eventos no forman parte del cache optimista; los invalidamos aquí para
    // que el nuevo evento de tracking se pinte tras la escritura real.
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
    },
    errorTitle: "Error al sincronizar estado",
    errorMethod: "SYNC_EMBARQUE_STATE",
  });
}



/**
 * Reabre un embarque cerrado (Cerrado → Entregado). Solo admin/super_admin.
 * El backend valida el rol y rechaza si el estado actual no es Cerrado.
 */
export function useReabrirEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, usuarioEmail, motivo, requestId }: { embarqueId: string; usuarioEmail: string; motivo: string; requestId?: string }) => {
      await reabrirEmbarqueRpc({
        embarqueId,
        usuarioEmail,
        motivo,
        requestId: requestId ?? newRequestId(),
      });
    },

    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.notas(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
    },
    // Toasts (éxito y error) manejados por el caller para evitar doble notificación.
    onError: () => {
      // No-op intencional: el caller maneja el toast de error.
    },
  });
}
