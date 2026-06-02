import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchFlujoProyectado } from "@/services/tesoreria/flujoProyectado";

export function useFlujoProyectado(dias = 90) {
  return useQuery({
    queryKey: queryKeys.tesoreria.flujoProyectado(dias),
    queryFn: () => fetchFlujoProyectado(dias),
    staleTime: 60_000,
  });
}
