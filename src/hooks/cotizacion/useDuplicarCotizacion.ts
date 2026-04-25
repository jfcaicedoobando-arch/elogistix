import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { duplicarCotizacion } from '@/services/cotizacionServices';

export function useDuplicarCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cotizacionId: string) => duplicarCotizacion(cotizacionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}
