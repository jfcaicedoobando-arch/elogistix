/**
 * Badge del sidebar: documentos del buzón CxP pendientes por capturar.
 * v13.502.0
 */
import { useQuery } from "@tanstack/react-query";
import { fetchEntrantesPorCapturarCount } from "@/features/cxp/services/facturasEntrantesCount";
import { cxp } from "@/features/cxp/queryKeys";

export function useEntrantesPorCapturarCount() {
  return useQuery({
    queryKey: cxp.facturasEntrantesPorCapturarCount,
    queryFn: fetchEntrantesPorCapturarCount,
    staleTime: 60_000,
    // Red de seguridad: si otro usuario captura un documento, el badge se
    // actualiza sin esperar a que este usuario recargue la app.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
