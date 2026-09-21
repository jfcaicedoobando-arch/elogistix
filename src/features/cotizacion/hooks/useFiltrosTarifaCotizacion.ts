/**
 * v13.823.392 · Auditoría cotización→embarque #3: precarga del buscador de
 * tarifas con la ruta y el tipo de contenedor de la cotización, para que
 * sustituir no ofrezca tarifas de otra ruta. La validación autoritativa está en
 * la base de datos.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchFiltrosTarifaCotizacion,
  type FiltrosTarifaCotizacion,
} from "@/features/cotizacion/services/filtrosTarifaCotizacion";

export function useFiltrosTarifaCotizacion(cotizacionId: string, enabled: boolean) {
  const { data } = useQuery<FiltrosTarifaCotizacion>({
    queryKey: queryKeys.cotizaciones.filtrosTarifa(cotizacionId),
    queryFn: () => fetchFiltrosTarifaCotizacion(cotizacionId),
    enabled: enabled && Boolean(cotizacionId),
    staleTime: 5 * 60 * 1000,
  });
  return data;
}
