import { useQuery } from "@tanstack/react-query";
import { fetchOportunidadCotizaciones, type OportunidadCotizacionRow } from "@/services/crm";
import { queryKeys } from "@/lib/query";

export function useOportunidadCotizaciones(oportunidadId: string) {
  return useQuery<OportunidadCotizacionRow[]>({
    queryKey: queryKeys.crm.opCotizaciones.byOportunidad(oportunidadId),
    queryFn: () => fetchOportunidadCotizaciones(oportunidadId),
    enabled: !!oportunidadId,
  });
}
