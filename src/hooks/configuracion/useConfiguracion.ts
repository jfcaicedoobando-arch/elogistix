import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query";
import {
  fetchConfiguracion,
  updateConfiguracionByCategoriaClave,
  type ConfigItem,
} from "@/services/configuracion";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export type { ConfigItem };

export function useConfiguracion() {
  return useQuery<ConfigItem[]>({
    queryKey: queryKeys.configuracion.all,
    queryFn: fetchConfiguracion,
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
  const { toast } = useToast();

  return useMutation({
    mutationFn: updateConfiguracionByCategoriaClave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracion.all });
      notifySuccess(toast, { title: "Configuración guardada" });
    },
    onError: (error: Error) => {
      notifyError(toast, { title: "Error al guardar", description: error.message});
    },
  });
}
