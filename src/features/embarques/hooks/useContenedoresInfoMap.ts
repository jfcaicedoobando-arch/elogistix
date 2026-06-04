/**
 * Hook React Query para `fetchContenedoresInfoMap`.
 *
 * Usado por la tabla de embarques para mostrar el primer contenedor real,
 * un badge `+N` cuando hay más de uno y un indicador "Datos pendientes"
 * cuando algún hijo carece de número o tipo de contenedor capturado
 * (v12.14.1). I/O delegada a `services/embarque/contenedores` (v12.14.3).
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchContenedoresInfoMap,
  type ContenedoresInfo,
  type ContenedoresInfoMap,
} from "@/services/embarque/contenedores/fetchInfoMap";

export type { ContenedoresInfo, ContenedoresInfoMap };

const QUERY_KEY = "embarque-contenedores-info-map" as const;

export function useContenedoresInfoMap(embarqueIds: string[]) {
  const ids = [...embarqueIds].sort();
  return useQuery<ContenedoresInfoMap, Error>({
    queryKey: [QUERY_KEY, ids],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: () => fetchContenedoresInfoMap(ids),
  });
}
