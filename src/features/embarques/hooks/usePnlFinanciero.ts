import { useQuery } from "@tanstack/react-query";
import { fetchPnlEmbarque, type PnlEmbarque } from "@/features/embarques/services/pnlFinanciero";
import { queryKeys } from "@/lib/query";

export function usePnlFinanciero(embarqueId: string | undefined) {
  return useQuery<PnlEmbarque>({
    queryKey: queryKeys.embarques.pnlFinanciero(embarqueId),
    queryFn: () => fetchPnlEmbarque(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
}
