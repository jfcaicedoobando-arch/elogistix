/**
 * Mutations: eliminación de embarques.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { eliminarEmbarqueRpc } from '@/services/embarque';

export function useEliminarEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (embarqueId: string) => eliminarEmbarqueRpc(embarqueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}
