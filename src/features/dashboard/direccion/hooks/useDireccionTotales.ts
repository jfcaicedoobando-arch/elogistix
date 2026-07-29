/**
 * FIX C3c: totales por moneda del tablero de Dirección agregados en el servidor.
 * No dependen de los caps de filas de los loaders, por lo que no se truncan.
 */
import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import { fetchDireccionTotales } from "@/features/dashboard/direccion/services/loaders";
import { ventanaDireccionDesdeIso } from "@/features/dashboard/direccion/services/mxn";

export function useDireccionTotales(hoy: Date = new Date()) {
  const { organizationId } = useOrgFilter();
  const desdeIso = ventanaDireccionDesdeIso(hoy);
  const query = useQuery({
    queryKey: queryKeys.direccion.totales(organizationId, desdeIso),
    queryFn: () => fetchDireccionTotales(desdeIso),
    staleTime: 60_000,
  });
  return { ...query, desdeIso };
}
