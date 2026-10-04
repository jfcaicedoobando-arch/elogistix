import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchTraspasoDetalle } from "@/features/tesoreria/services/traspasoDetalle";

/** Consulta de lectura propia del traspaso; comparte caché entre sus tres patas. */
export function useTraspasoDetalle(id: string) {
  return useQuery({
    queryKey: queryKeys.tesoreria.pagoDetalle("traspaso", id),
    queryFn: () => fetchTraspasoDetalle(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}
