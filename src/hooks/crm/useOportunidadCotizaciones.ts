import { useQuery } from "@tanstack/react-query";
import { fetchOportunidadCotizaciones, type OportunidadCotizacionRow } from "@/services/crm";

export function useOportunidadCotizaciones(oportunidadId: string) {
  return useQuery<OportunidadCotizacionRow[]>({
    queryKey: ["crm", "op-cotizaciones", oportunidadId],
    queryFn: () => fetchOportunidadCotizaciones(oportunidadId),
    enabled: !!oportunidadId,
  });
}
