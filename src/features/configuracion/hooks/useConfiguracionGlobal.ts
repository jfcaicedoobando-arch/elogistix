import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchConfiguracionGlobal,
  updateConfiguracionGlobalItems,
  type ConfigGlobalItem,
} from "@/features/configuracion/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export type { ConfigGlobalItem };

export function useConfiguracionGlobal() {
  return useQuery<ConfigGlobalItem[]>({
    queryKey: queryKeys.configuracionGlobal.all,
    queryFn: fetchConfiguracionGlobal,
    staleTime: 5 * 60 * 1000,
  });
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

  return useMutation({
    mutationFn: updateConfiguracionGlobalItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracionGlobal.all });
      notifySuccess(undefined, { title: "Configuración global guardada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "Error al guardar", description: error.message, method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    },
  });
}
