import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Hook que obtiene los operadores únicos desde una RPC server-side.
 * Corrige el bug donde el filtro solo mostraba operadores de la página actual.
 */
export function useOperadoresDistintos() {
  return useQuery({
    queryKey: queryKeys.operadores.distintos,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("operadores_distintos");
      if (error) throw error;
      return (data ?? []).map((r: { operador: string }) => r.operador);
    },
  });
}
