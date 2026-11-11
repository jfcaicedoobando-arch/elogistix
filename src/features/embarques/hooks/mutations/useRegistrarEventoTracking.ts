import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";
import { captureAuthDataScope } from "@/lib/auth/authOperationScope";
import { queryKeys } from "@/lib/query";
import { registrarEventoTracking, type DatosEventoTracking } from "../../services/registrarEventoTracking";

export function useRegistrarEventoTracking() {
  const queryClient = useQueryClient();
  const intentos = useRef(new Map<string, string>());
  const enviando = useRef(false);
  const mutation = useMutationWithFeedback({
    mutationFn: registrarEventoTracking,
    invalidate: [queryKeys.embarques.all, queryKeys.auditoria.embarques],
    silent: true,
    onSuccess: (_data, { embarqueId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.embarques.eventos(embarqueId) });
    },
  });

  async function registrar(input: DatosEventoTracking) {
    if (enviando.current) return false;
    const scope = captureAuthDataScope();
    const ubicacion = input.ubicacion.trim();
    const key = JSON.stringify([scope.generation, input.embarqueId, input.accion, input.fecha, ubicacion]);
    const requestId = intentos.current.get(key) ?? crypto.randomUUID();
    intentos.current.set(key, requestId);
    enviando.current = true;
    try {
      await mutation.mutateAsync({ ...input, ubicacion, requestId, scope });
      intentos.current.delete(key);
      return scope.isCurrent();
    } catch (error) {
      if (!scope.isCurrent()) return false;
      throw error;
    } finally {
      enviando.current = false;
    }
  }

  return { registrar, isPending: mutation.isPending };
}
