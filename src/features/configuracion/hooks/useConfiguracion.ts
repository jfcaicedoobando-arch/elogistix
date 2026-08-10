import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchConfiguracion,
  updateConfiguracionByCategoriaClave,
  type ConfigItem,
} from "@/features/configuracion/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

export type { ConfigItem };

export function useConfiguracion() {
  // Ola 4 · N11: la configuración es org-scope. La org efectiva es la fuente
  // única A2: la propia org para usuarios normales; el tenant elegido en el
  // OrgSwitcher para super_admin. Nunca useAuth().organizationId (null para
  // super_admin).
  const { organizationId } = useOrgActiva();
  return useQuery<ConfigItem[]>({
    queryKey: organizationId
      ? queryKeys.configuracionOrg.byOrg(organizationId)
      : ["noop"],
    enabled: !!organizationId,
    queryFn: () => fetchConfiguracion(organizationId as string),
    staleTime: 5 * 60 * 1000,
  });
}

/** Get a single config value with a fallback */
export function useConfigValue<T>(categoria: string, clave: string, fallback: T): T {
  const { data } = useConfiguracion();
  if (!data) return fallback;
  const item = data.find((c) => c.categoria === categoria && c.clave === clave);
  if (!item) return fallback;
  return item.valor as T;
}


export function useUpdateConfiguracion() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrgActiva();

  return useMutation({
    mutationFn: (items: { categoria: string; clave: string; valor: unknown }[]) => {
      // Ola 4 · N11 (fail-closed): sin org activa NO se guarda nada — antes
      // este guardado pisaba la clave en todas las organizaciones.
      if (!organizationId) {
        throw new Error("Selecciona una organización antes de guardar la configuración.");
      }
      return updateConfiguracionByCategoriaClave(organizationId, items);
    },
    onSuccess: () => {
      // ['configuracion'] es prefijo de ['configuracion','org',<id>]: cubre la
      // key nueva y las de useConfiguracionByOrg (impersonación).
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracion.all });
      notifySuccess(undefined, { title: "Configuración guardada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "Error al guardar", description: error.message, method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    },
  });
}
