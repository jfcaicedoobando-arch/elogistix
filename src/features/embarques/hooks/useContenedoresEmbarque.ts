/**
 * Hook React Query para listar contenedores de un embarque.
 */
import { useQuery } from "@tanstack/react-query";
import { listarPorEmbarque } from "@/features/embarques/services/contenedores";
import type { EmbarqueContenedor } from "@/features/embarques/types/contenedor";
import { queryKeys } from "@/lib/query";

export function useContenedoresEmbarque(embarqueId: string | undefined) {
  return useQuery<EmbarqueContenedor[], Error>({
    queryKey: queryKeys.embarques.contenedores(embarqueId),
    queryFn: () => {
      if (!embarqueId) return Promise.resolve([]);
      return listarPorEmbarque(embarqueId);
    },
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
}
