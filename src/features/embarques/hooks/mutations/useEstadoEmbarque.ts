/**
 * Mutations de cambio de estado del embarque: avanzar, sync automático y reabrir.
 * v13.278.0 · `useSyncEstadoEmbarque` escribe el estado en caché de forma
 * optimista (detail + full) con rollback automático si la mutación falla.
 * Ola 2 · O2.8 — el auto-sync ya NO escribe directo en `embarques`: viaja por
 * la RPC `avanzar_estado_embarque` con un requestId estable por transición, de
 * modo que hereda el candado de documentos, el FOR UPDATE y la guarda optimista.
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

import { useMutationWithFeedback } from '@/hooks/shared/useMutationWithFeedback';

/**
 * requestId estable por (embarque, estado destino): dos renders (o dos
 * pestañas del mismo navegador) del mismo auto-sync reusan la llave y la RPC
 * devuelve la respuesta cacheada en vez de duplicar nota y evento.
 */
const requestIdsAutoSync = new Map<string, string>();
function requestIdTransicion(embarqueId: string, nuevoEstado: string): string {
  const clave = `${embarqueId}:${nuevoEstado}`;
  const existente = requestIdsAutoSync.get(clave);
  if (existente) return existente;
  const nuevo = newRequestId();
  requestIdsAutoSync.set(clave, nuevo);
  return nuevo;
}

/**
 * Rechazos esperados del auto-sync: el estado sugerido por fechas no procede
 * todavía (faltan documentos, falta la llegada real, la transición no aplica o
 * alguien más movió el embarque). No son errores del usuario: se ignoran en
 * silencio y el cambio manual sigue mostrando el motivo.
 */
const RECHAZOS_ESPERADOS_AUTOSYNC = [
  'documentos_faltantes',
  'fecha_llegada_real_requerida',
  'LC_TRANSICION_INVALIDA',
  'LC_ESTADO_CONCURRENTE',
];

function esRechazoEsperado(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error ?? '');
  return RECHAZOS_ESPERADOS_AUTOSYNC.some((codigo) => mensaje.includes(codigo));
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
      // códigos LC_*) vive en `src/lib/errors/lcCodes.ts` y la aplica
      // `getErrorMessage` en el wrapper `useMutationWithFeedback`.
      try {
        await avanzarEstadoEmbarqueRpc({
          embarqueId,
          nuevoEstado,
          usuarioEmail: usuarioEmail && usuarioEmail.trim() ? usuarioEmail : 'sistema',
          tipoEvento: tipoEventoParaEstado(nuevoEstado),
          descripcionEvento: descripcionEventoCambioEstado(nuevoEstado),
          requestId: requestIdTransicion(embarqueId, nuevoEstado),
        });
      } catch (error) {
        if (esRechazoEsperado(error)) {
          // Estado sugerido por fechas que aún no procede: no es error de usuario.
          return;
        }
        throw error;
      }
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
