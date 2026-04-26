import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query";
import {
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
  fetchConfiguracionByOrg,
  updateConfiguracionItems,
  type ConfigItem,
} from "@/services/configuracion";

export type { ConfigItem };

/** Config para una org específica (impersonación) */
export function useConfiguracionByOrg(orgId: string | null) {
  return useQuery<ConfigItem[]>({
    queryKey: orgId ? queryKeys.configuracionOrg.byOrg(orgId) : ["noop"],
    enabled: !!orgId,
    queryFn: () => fetchConfiguracionByOrg(orgId!),
    staleTime: 60 * 1000,
  });
}

export function useUpdateConfiguracionOrg() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (items: { id: string; valor: unknown }[]) => updateConfiguracionItems(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracion.all });
      notifySuccess(toast, { title: "Configuración de organización guardada" });
    },
    onError: (error: Error) => {
      notifyError(toast, { title: "Error al guardar", description: error.message});
    },
  });
}
