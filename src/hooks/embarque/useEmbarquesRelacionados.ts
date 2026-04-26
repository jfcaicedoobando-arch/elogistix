import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchEmbarquesRelacionados } from "@/services/embarque";

/**
 * Devuelve embarques que comparten BL Master con el embarque actual (excluyéndolo).
 */
export function useEmbarquesRelacionados(embarqueId: string, blMaster: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.relacionados(embarqueId, blMaster ?? ""),
    queryFn: () => (blMaster ? fetchEmbarquesRelacionados(embarqueId, blMaster) : Promise.resolve([])),
    enabled: !!blMaster,
  });
}
