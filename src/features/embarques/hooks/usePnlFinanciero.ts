import { useQuery } from "@tanstack/react-query";
import { fetchPnlEmbarque, type PnlEmbarque } from "@/features/embarques/services/pnlFinanciero";

export function usePnlFinanciero(embarqueId: string | undefined) {
  return useQuery<PnlEmbarque>({
    queryKey: ["embarque", embarqueId, "pnl-financiero"],
    queryFn: () => fetchPnlEmbarque(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
}
