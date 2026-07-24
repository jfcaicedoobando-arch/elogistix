import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { useMutationWithFeedback } from '@/hooks/shared';
import type { CreateCotizacionInput } from '@/features/cotizacion/types';
import {
  crearCotizacion as svcCrear,
  updateCotizacion as svcUpdate,
  deleteCotizacion as svcDelete,
  updateEstadoCotizacion as svcUpdateEstado,
  reactivarCotizacion as svcReactivar,
} from '@/features/cotizacion/services';
import { notifySuccess } from '@/lib/ui/appFeedback';

export function useCreateCotizacion() {
  return useMutationWithFeedback({
    mutationFn: (input: CreateCotizacionInput) => svcCrear(input),
    invalidate: queryKeys.cotizaciones.all,
    successTitle: "Cotización creada",
    errorTitle: "Error al crear cotización",
    errorMethod: "CREATE_COTIZACION",
  });
}

export function useUpdateCotizacion() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCotizacionInput> }) =>
      svcUpdate(id, data),
    invalidate: queryKeys.cotizaciones.all,
    successTitle: "Cotización actualizada",
    errorTitle: "Error al actualizar cotización",
    errorMethod: "UPDATE_COTIZACION",
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.id) });
    },
  });
}

export function useDeleteCotizacion() {
  return useMutationWithFeedback({
    mutationFn: (id: string) => svcDelete(id),
    invalidate: queryKeys.cotizaciones.all,
    successTitle: "Cotización eliminada",
    errorTitle: "Error al eliminar cotización",
    errorMethod: "DELETE_COTIZACION",
  });
}

// El título del toast depende del `estado` (aprobar/rechazar/…): el wrapper
// gestiona el error traducido y las invalidaciones; el success dinámico se
// emite manualmente para no diluir el mensaje.
export function useUpdateEstadoCotizacion() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    mutationFn: ({ id, estado, embarqueId }: { id: string; estado: string; embarqueId?: string | null }) =>
      svcUpdateEstado(id, estado, embarqueId),
    invalidate: queryKeys.cotizaciones.all,
    errorTitle: "Error al actualizar estado",
    errorMethod: "UPDATE_COTIZACION_STATE",
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.id) });
      notifySuccess(undefined, { title: `Cotización ${vars.estado}` });
    },
  });
}

export function useReactivarCotizacion() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    mutationFn: (id: string) => svcReactivar(id),
    invalidate: queryKeys.cotizaciones.all,
    successTitle: "Cotización reactivada",
    errorTitle: "Error al reactivar cotización",
    errorMethod: "REACTIVATE_COTIZACION",
    onSuccess: (_r, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(id) });
    },
  });
}
