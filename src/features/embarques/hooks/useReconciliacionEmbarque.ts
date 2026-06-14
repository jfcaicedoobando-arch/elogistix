/**
 * Hook: conciliación cotizado vs real de un embarque (Fase 2).
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchReconciliacionEmbarque,
  type FilaReconciliacion,
} from "@/features/embarques/services/reconciliacionCostos";

export type { FilaReconciliacion };

export function useReconciliacionEmbarque(embarqueId: string | undefined) {
  return useQuery({
    queryKey: ["embarques", "reconciliacion", embarqueId] as const,
    queryFn: () => fetchReconciliacionEmbarque(embarqueId!),
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
}
