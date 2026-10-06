import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchConceptosFacturaSnapshot } from "../services/conceptosFacturaSnapshot";

export function useConceptosFacturaSnapshot(facturaId: string | null) {
  return useQuery({
    queryKey: queryKeys.cxp.conceptosSnapshot(facturaId),
    queryFn: () => fetchConceptosFacturaSnapshot(facturaId!),
    enabled: !!facturaId,
    staleTime: 0,
  });
}
