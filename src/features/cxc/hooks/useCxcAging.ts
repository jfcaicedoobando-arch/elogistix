import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCxcAging, calcularTotalesAging } from "@/features/cxc/services/cxcAging";
import { queryKeys } from "@/lib/query";

export function useCxcAging(fecha?: string) {
  const q = useQuery({
    queryKey: queryKeys.cxc.aging(fecha),
    queryFn: () => fetchCxcAging(fecha),
    staleTime: 60_000,
  });
  const totales = useMemo(() => calcularTotalesAging(q.data ?? []), [q.data]);
  return { ...q, totales };
}
