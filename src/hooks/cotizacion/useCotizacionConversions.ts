import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import type { CotizacionRow } from './useCotizacionTypes';
import {
  convertirProspectoACliente,
  convertirCotizacionAEmbarques,
  type ProspectoAClienteInput,
} from '@/services/cotizacionServices';

/** Convierte un prospecto en cliente y actualiza la cotización */
export function useConvertirProspectoACliente() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({
      cotizacionId,
      clienteData,
    }: Omit<ProspectoAClienteInput, 'user'>) =>
      convertirProspectoACliente({ cotizacionId, clienteData, user }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
    },
  });
}

/** Convierte una cotización en uno o más embarques según num_contenedores */
export function useConvertirCotizacionAEmbarques() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cotizacion: CotizacionRow) => convertirCotizacionAEmbarques(cotizacion),
    onSuccess: (_data, cotizacion) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(cotizacion.id) });
    },
  });
}
