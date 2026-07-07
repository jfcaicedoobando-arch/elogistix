/**
 * Mutations: eliminación de embarques.
 *
 * Nota: este hook NO dispara toasts — la UI que consume la mutación
 * (actualmente `DialogEliminarEmbarque`) es responsable de notificar
 * al usuario con el mensaje enriquecido (expediente / error real).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { eliminarEmbarqueRpc } from '@/features/embarques/services';

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
