/**
 * Badge del sidebar: documentos del buzón CxP pendientes por capturar.
 * v13.504.0 — Sincronizado en tiempo real + revalidación periódica de respaldo.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEntrantesPorCapturarCount } from "@/features/cxp/services/facturasEntrantesCount";
import { subscribeEntrantesBuzon } from "@/features/cxp/services/facturasEntrantesRealtime";
import { cxp } from "@/features/cxp/queryKeys";

export function useEntrantesPorCapturarCount() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Realtime: cualquier alta/captura/retiro del buzón invalida el conteo.
    return subscribeEntrantesBuzon(() => {
      void queryClient.invalidateQueries({
        queryKey: cxp.facturasEntrantesPorCapturarCount,
      });
    });
  }, [queryClient]);

  return useQuery({
    queryKey: cxp.facturasEntrantesPorCapturarCount,
    queryFn: fetchEntrantesPorCapturarCount,
    staleTime: 60_000,
    // Red de seguridad si el canal realtime se cae o el navegador dormía.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
