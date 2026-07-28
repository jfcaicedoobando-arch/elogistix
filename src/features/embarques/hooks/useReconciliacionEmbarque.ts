/**
 * Hook: conciliación cotizado vs real de un embarque (Fase 2).
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchReconciliacionEmbarque,
} from "@/features/embarques/services/reconciliacionCostos";
import { queryKeys } from "@/lib/query";

;

export function useReconciliacionEmbarque(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.reconciliacion(embarqueId),
    queryFn: () => fetchReconciliacionEmbarque(embarqueId!),
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
}
