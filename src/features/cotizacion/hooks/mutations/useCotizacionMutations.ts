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
import { notifyError, notifySuccess } from '@/lib/ui/appFeedback';

export function useCreateCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCotizacionInput) => svcCrear(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      notifySuccess(undefined, { title: "Cotización creada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear cotización: ${error.message}`, error, method: "CREATE_COTIZACION" });
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
      notifySuccess(undefined, { title: "Cotización actualizada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar cotización: ${error.message}`, error, method: "UPDATE_COTIZACION" });
    },
  });
}

export function useDeleteCotizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svcDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      notifySuccess(undefined, { title: "Cotización eliminada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar cotización: ${error.message}`, error, method: "DELETE_COTIZACION" });
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
      notifySuccess(undefined, { title: `Cotización ${vars.estado}` });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar estado: ${error.message}`, error, method: "UPDATE_COTIZACION_STATE" });
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
      notifySuccess(undefined, { title: "Cotización reactivada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al reactivar cotización: ${error.message}`, error, method: "REACTIVATE_COTIZACION" });
    },
  });
}
