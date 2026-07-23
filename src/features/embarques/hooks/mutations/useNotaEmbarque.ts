/**
 * Mutation: crear nota en el embarque.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { insertarNotaEmbarque } from '@/features/embarques/services';
import { notifyError, notifySuccess } from '@/lib/ui/appFeedback';

export function useCreateNotaEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueId, contenido, usuario }: { embarqueId: string; contenido: string; usuario: string }) =>
      insertarNotaEmbarque(embarqueId, contenido, usuario),
    onSuccess: (_resultado, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.notas(vars.embarqueId) });
      notifySuccess(undefined, { title: "Nota agregada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al agregar nota: ${error.message}`, error, method: "CREATE_NOTA_EMBARQUE" });
    },
  });
}
