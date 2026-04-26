import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  fetchConfiguracionGlobal,
  updateConfiguracionGlobalItems,
  type ConfigGlobalItem,
} from "@/services/configuracion";

export type { ConfigGlobalItem };

export function useConfiguracionGlobal() {
  return useQuery<ConfigGlobalItem[]>({
    queryKey: queryKeys.configuracionGlobal.all,
    queryFn: fetchConfiguracionGlobal,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConfigGlobalValue<T>(categoria: string, clave: string, fallback: T): T {
  const { data } = useConfiguracionGlobal();
  if (!data) return fallback;
  const item = data.find((c) => c.categoria === categoria && c.clave === clave);
  if (!item) return fallback;
  return item.valor as T;
}

export function useConfigGlobalCategoria(categoria: string): Record<string, unknown> {
  const { data } = useConfiguracionGlobal();
  if (!data) return {};
  const result: Record<string, unknown> = {};
  data.filter((c) => c.categoria === categoria).forEach((c) => {
    result[c.clave] = c.valor;
  });
  return result;
}

export function useUpdateConfiguracionGlobal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: updateConfiguracionGlobalItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracionGlobal.all });
      notifySuccess(toast, { title: "Configuración global guardada" });
    },
    onError: (error: Error) => {
      notifyError(toast, { title: "Error al guardar", message: error.message });
    },
  });
}
