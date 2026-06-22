import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCxpAging, calcularTotalesAging } from "@/features/cxp/services/cxpAging";

export function useCxpAging(fecha?: string) {
  const q = useQuery({
    queryKey: ["cxp", "aging", fecha ?? "hoy"] as const,
    queryFn: () => fetchCxpAging(fecha),
    staleTime: 60_000,
  });
  const totales = useMemo(() => calcularTotalesAging(q.data ?? []), [q.data]);
  return { ...q, totales };
}
