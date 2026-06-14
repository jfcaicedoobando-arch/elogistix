import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchConfiguracionByOrg,
  type ConfigItem,
} from "@/features/configuracion/services";

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

