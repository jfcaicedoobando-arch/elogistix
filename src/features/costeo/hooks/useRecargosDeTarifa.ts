/**
 * Recargos aplicables a una tarifa vigente, usados en el desglose de TarifaResultCard.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchRecargosDeTarifa } from "@/features/costeo/services/topTarifas";

export function useRecargosDeTarifa(tarifaId: string) {
  return useQuery({
    queryKey: queryKeys.costeo.tarifas.recargos(tarifaId),
    queryFn: () => fetchRecargosDeTarifa(tarifaId),
    staleTime: 60 * 1000,
  });
}
