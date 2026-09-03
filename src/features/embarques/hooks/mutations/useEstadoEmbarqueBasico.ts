/**
 * Mutations simples de estado del embarque: avanzar (uso manual/wizard) y
 * reabrir (Cerrado → Entregado). El auto-sync con reintento y candado vive en
 * useEstadoEmbarque.ts (useSyncEstadoEmbarque).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  avanzarEstadoEmbarqueRpc,
  reabrirEmbarqueRpc,
} from '@/features/embarques/services';
import {
  tipoEventoParaEstado,
  descripcionEventoCambioEstado,
} from '@/features/embarques/domain/embarque';
import { newRequestId } from '@/lib/idempotency';

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

/**
 * Reabre un embarque cerrado (Cerrado → Entregado). Solo admin/super_admin.
 * El backend valida el rol y rechaza si el estado actual no es Cerrado.
 */
export function useReabrirEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, usuarioEmail, motivo, requestId }: { embarqueId: string; usuarioEmail: string; motivo: string; requestId?: string }) => {
      return await reabrirEmbarqueRpc({
        embarqueId,
        usuarioEmail,
        motivo,
        requestId: requestId ?? newRequestId(),
      });
    },

    onSuccess: (resultado, vars) => {
      // v13.823.47 — un claim de idempotencia en vuelo no reabrió nada en ESTA
      // llamada: no invalidamos caché para no pintar un estado inexistente.
      if (resultado.pendiente) return;
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
