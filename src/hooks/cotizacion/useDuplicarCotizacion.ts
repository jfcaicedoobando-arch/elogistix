import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { duplicarCotizacion } from '@/services/cotizacion';

export function useDuplicarCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cotizacionId: string) => duplicarCotizacion(cotizacionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}
