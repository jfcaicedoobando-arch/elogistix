import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCxpAging, calcularTotalesAging } from "@/features/cxp/services/cxpAging";
import { queryKeys } from "@/lib/query";

export function useCxpAging(fecha?: string) {
  const q = useQuery({
    queryKey: queryKeys.cxp.aging(fecha),
    queryFn: () => fetchCxpAging(fecha),
    staleTime: 60_000,
  });
  const totales = useMemo(() => calcularTotalesAging(q.data ?? []), [q.data]);
  return { ...q, totales };
}
