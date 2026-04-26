import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchEmbarquesListExtras } from "@/services/embarque";

/**
 * Single RPC call to fetch liquidation + document counts for a page of embarques.
 */
export function useEmbarquesListExtras(embarqueIds: string[]) {
  return useQuery({
    queryKey: [...queryKeys.embarques.all, 'list-extras', embarqueIds],
    queryFn: () => fetchEmbarquesListExtras(embarqueIds),
    enabled: embarqueIds.length > 0,
  });
}
