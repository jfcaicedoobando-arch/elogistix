import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query";
import {
  fetchConfiguracionByOrg,
  updateConfiguracionItems,
  type ConfigItem,
} from "@/services/configuracion";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

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

