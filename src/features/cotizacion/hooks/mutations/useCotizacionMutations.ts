import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { CreateCotizacionInput } from '@/features/cotizacion/types';
import {
  crearCotizacion as svcCrear,
  updateCotizacion as svcUpdate,
  deleteCotizacion as svcDelete,
  updateEstadoCotizacion as svcUpdateEstado,
  reactivarCotizacion as svcReactivar,
} from '@/features/cotizacion/services';

export function useCreateCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCotizacionInput) => svcCrear(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}

export function useUpdateCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCotizacionInput> }) =>
      svcUpdate(id, data),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.id) });
    },
  });
}

export function useDeleteCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svcDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}

export function useUpdateEstadoCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado, embarqueId }: { id: string; estado: string; embarqueId?: string | null }) =>
      svcUpdateEstado(id, estado, embarqueId),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.id) });
    },
  });
}

export function useReactivarCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svcReactivar(id),
    onSuccess: (_r, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(id) });
    },
  });
}
