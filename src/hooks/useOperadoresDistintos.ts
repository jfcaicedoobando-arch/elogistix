import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchOperadoresDistintos } from "@/services/reportesService";

/**
 * Hook que obtiene los operadores únicos desde una RPC server-side.
 * Corrige el bug donde el filtro solo mostraba operadores de la página actual.
 */
export function useOperadoresDistintos() {
  return useQuery({
    queryKey: queryKeys.operadores.distintos,
    queryFn: fetchOperadoresDistintos,
  });
}
