/**
 * Badge del sidebar: documentos del buzón CxP pendientes por capturar.
 * v13.504.0 — Sincronizado en tiempo real + revalidación periódica de respaldo.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEntrantesPorCapturarCount } from "@/features/cxp/services/facturasEntrantesCount";
import { subscribeEntrantesBuzon } from "@/features/cxp/services/facturasEntrantesRealtime";
import { cxp } from "@/features/cxp/queryKeys";
import { staleTimes } from "@/lib/query/staleTimes";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

export function useEntrantesPorCapturarCount() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrgActiva();

  useEffect(() => {
    // EC-09: el canal se filtra por organización; sin org activa no se suscribe.
    if (!organizationId) return;
    // Realtime: cualquier alta/captura/retiro del buzón invalida el conteo.
    return subscribeEntrantesBuzon(organizationId, () => {
      void queryClient.invalidateQueries({
        queryKey: cxp.facturasEntrantesPorCapturarCount,
      });
    });
  }, [queryClient, organizationId]);

  return useQuery({
    // La org va en la key: al cambiar de tenant (OrgSwitcher del super admin)
    // el badge no muestra la cifra cacheada del tenant anterior. La
    // invalidación por realtime sigue matcheando por prefijo.
    queryKey: [...cxp.facturasEntrantesPorCapturarCount, organizationId ?? "sin-org"],
    queryFn: () => fetchEntrantesPorCapturarCount(organizationId),
    staleTime: staleTimes.LONG,
    // PERF (auditoría 2026-08-18, hallazgo #2): antes 60 s → 2,385 llamadas
    // registradas. El canal realtime ya invalida el conteo al instante, así que
    // este intervalo es sólo red de seguridad si el canal se cae o el navegador
    // dormía: 15 min es suficiente y quita ruido constante de red.
    refetchInterval: 15 * 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
