/**
 * Mutations de cambio de estado del embarque: avanzar, sync automático y reabrir.
 * v13.278.0 · `useSyncEstadoEmbarque` escribe el estado en caché de forma
 * optimista (detail + full) con rollback automático si la mutación falla.
 * Ola 2 · O2.8 — el auto-sync ya NO escribe directo en `embarques`: viaja por
 * la RPC `avanzar_estado_embarque` con un requestId estable por transición, de
 * modo que hereda el candado de documentos, el FOR UPDATE y la guarda optimista.
 */
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  avanzarEstadoEmbarqueRpc,
} from '@/features/embarques/services';
import {
  tipoEventoParaEstado,
  descripcionEventoCambioEstado,
} from '@/features/embarques/domain/embarque';

import { useMutationWithFeedback } from '@/hooks/shared/useMutationWithFeedback';
import {
  requestIdTransicion,
  invalidarRequestIdTransicion,
  esRechazoEsperado,
} from './useEstadoEmbarque.helpers';

export { useAvanzarEstadoEmbarque, useReabrirEmbarque } from './useEstadoEmbarqueBasico';

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
        const resultado = await avanzarEstadoEmbarqueRpc({
          embarqueId,
          nuevoEstado,
          usuarioEmail: usuarioEmail && usuarioEmail.trim() ? usuarioEmail : 'sistema',
          tipoEvento: tipoEventoParaEstado(nuevoEstado),
          descripcionEvento: descripcionEventoCambioEstado(nuevoEstado),
          requestId: requestIdTransicion(embarqueId, nuevoEstado),
        });
        if (resultado?.replay) {
          // M-3: la llave estaba vieja (p. ej. el embarque se reabrió y el
          // auto-sync sugiere la misma transición otra vez): la RPC devolvió
          // la respuesta cacheada SIN ejecutar el avance. Se regenera la llave
          // y se reintenta UNA vez — con requestId fresco la transición se
          // ejecuta (o el candado la rechaza, manejado abajo) y la bitácora la
          // escribe esta ejecución real.
          invalidarRequestIdTransicion(embarqueId, nuevoEstado);
          await avanzarEstadoEmbarqueRpc({
            embarqueId,
            nuevoEstado,
            usuarioEmail: usuarioEmail && usuarioEmail.trim() ? usuarioEmail : 'sistema',
            tipoEvento: tipoEventoParaEstado(nuevoEstado),
            descripcionEvento: descripcionEventoCambioEstado(nuevoEstado),
            requestId: requestIdTransicion(embarqueId, nuevoEstado),
          });
        }
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
