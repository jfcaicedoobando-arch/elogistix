import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchConceptosFacturaSnapshot } from "../services/conceptosFacturaSnapshot";

export function useConceptosFacturaSnapshot(facturaId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.cxp.facturaEditRow(facturaId), "conceptos-snapshot"],
    queryFn: () => fetchConceptosFacturaSnapshot(facturaId!),
    enabled: !!facturaId,
    staleTime: 0,
  });
}
