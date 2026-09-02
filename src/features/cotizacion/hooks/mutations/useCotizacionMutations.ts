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
import { invalidatePortalMirrors } from '@/features/portal/hooks/invalidatePortalMirrors';

// v13.320.36 (B-041) — El wizard emite un único toast final ("Cotización
// creada/actualizada exitosamente") desde `useCotizacionWizardSteps`. Estos
// hooks se disparan también en pasos intermedios (paso 1/2/3), así que no
// deben auto-toastear success para no duplicar/contradecir mensajes.
// VB-33: además, el wizard ya atrapa y notifica los errores con contexto
// (sección + scroll al campo), así que estos dos hooks van en `silent` para
// no emitir un segundo toast genérico del mismo fallo.
export function useCreateCotizacion() {
  return useMutationWithFeedback({
    mutationFn: (input: CreateCotizacionInput) => svcCrear(input),
    invalidate: queryKeys.cotizaciones.all,
    errorTitle: "Error al crear cotización",
    errorMethod: "CREATE_COTIZACION",
    silent: true,
  });
}

export function useUpdateCotizacion() {
  const queryClient = useQueryClient();
  return useMutationWithFeedback({
    // N-06 (QA r2): `expectedUpdatedAt` opcional = bloqueo optimista; el
    // servicio devuelve el nuevo `updated_at` para la siguiente escritura.
    mutationFn: ({ id, data, expectedUpdatedAt }: {
      id: string;
      data: Partial<CreateCotizacionInput>;
      expectedUpdatedAt?: string | null;
    }) => svcUpdate(id, data, expectedUpdatedAt),
    invalidate: queryKeys.cotizaciones.all,
    errorTitle: "Error al actualizar cotización",
    errorMethod: "UPDATE_COTIZACION",
    silent: true,
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.id) });
      invalidatePortalMirrors(queryClient, { cotizacionId: vars.id });
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
      invalidatePortalMirrors(queryClient, { cotizacionId: vars.id });
      // v13.823.57 — la BD cierra/actualiza la oportunidad al aceptar u operar
      // la cotización: refrescamos CRM para no mostrar etapa/monto rancios.
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.higiene.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
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
      invalidatePortalMirrors(queryClient, { cotizacionId: id });
    },
  });
}
