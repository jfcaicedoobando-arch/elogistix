import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchOperadoresDistintos } from "@/features/reportes/services";

/**
 * Hook que obtiene los operadores únicos desde una RPC server-side.
 * Corrige el bug donde el filtro solo mostraba operadores de la página actual.
 */
export function useOperadoresDistintos() {
  return useQuery({
    queryKey: queryKeys.operadores.distintos,
    queryFn: fetchOperadoresDistintos,
    // Catálogo derivado: estable durante la sesión, evitar refetch por mount.
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}
