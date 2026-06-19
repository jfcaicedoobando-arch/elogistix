/**
 * Mutations: eliminación de embarques.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { eliminarEmbarqueRpc } from '@/features/embarques/services';
import { notifyError, notifySuccess } from '@/components/shared/utils/appFeedback';

export function useEliminarEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (embarqueId: string) => eliminarEmbarqueRpc(embarqueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      notifySuccess(undefined, { title: "Embarque eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar embarque: ${error.message}`, error, method: "DELETE_EMBARQUE" });
    },
  });
}
