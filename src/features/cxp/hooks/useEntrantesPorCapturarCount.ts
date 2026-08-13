/**
 * Badge del sidebar: documentos del buzón CxP pendientes por capturar.
 * v13.504.0 — Sincronizado en tiempo real + revalidación periódica de respaldo.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEntrantesPorCapturarCount } from "@/features/cxp/services/facturasEntrantesCount";
import { subscribeEntrantesBuzon } from "@/features/cxp/services/facturasEntrantesRealtime";
import { cxp } from "@/features/cxp/queryKeys";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

export function useEntrantesPorCapturarCount() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrgActiva();

  useEffect(() => {
    // Realtime: cualquier alta/captura/retiro del buzón invalida el conteo.
    return subscribeEntrantesBuzon(() => {
      void queryClient.invalidateQueries({
        queryKey: cxp.facturasEntrantesPorCapturarCount,
      });
    });
  }, [queryClient]);

  return useQuery({
    // La org va en la key: al cambiar de tenant (OrgSwitcher del super admin)
    // el badge no muestra la cifra cacheada del tenant anterior. La
    // invalidación por realtime sigue matcheando por prefijo.
    queryKey: [...cxp.facturasEntrantesPorCapturarCount, organizationId ?? "sin-org"],
    queryFn: () => fetchEntrantesPorCapturarCount(organizationId),
    staleTime: 60_000,
    // Red de seguridad si el canal realtime se cae o el navegador dormía.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
