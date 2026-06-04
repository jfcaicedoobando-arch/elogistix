/**
 * Hook React Query para listar contenedores de un embarque.
 */
import { useQuery } from "@tanstack/react-query";
import { listarPorEmbarque } from "@/features/embarques/services/contenedores";
import type { EmbarqueContenedor } from "@/features/embarques/types/contenedor";

export const CONTENEDORES_QUERY_KEY = "embarque-contenedores" as const;

export function useContenedoresEmbarque(embarqueId: string | undefined) {
  return useQuery<EmbarqueContenedor[], Error>({
    queryKey: [CONTENEDORES_QUERY_KEY, embarqueId],
    queryFn: () => {
      if (!embarqueId) return Promise.resolve([]);
      return listarPorEmbarque(embarqueId);
    },
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
}
