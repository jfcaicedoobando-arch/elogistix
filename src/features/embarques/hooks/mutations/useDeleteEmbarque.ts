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
import { invalidateProfitDependencies } from '@/features/profit/hooks/invalidateProfitDependencies';
import type { captureAuthOperationScope } from '@/lib/auth/authOperationScope';

export function useEliminarEmbarque(authScope?: ReturnType<typeof captureAuthOperationScope>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (embarqueId: string) => authScope
      ? eliminarEmbarqueRpc(embarqueId, authScope)
      : eliminarEmbarqueRpc(embarqueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      invalidateProfitDependencies(queryClient);
    },
  });
}
