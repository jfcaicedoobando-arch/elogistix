import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchProfitPorEmbarque } from "@/services/reportesService";

/**
 * Hook compartido que consulta profit agregado por embarque desde una RPC server-side.
 * Reemplaza las dos queries separadas a conceptos_venta y conceptos_costo.
 */
export function useProfitMaps() {
  const { data: profitRows = [] } = useQuery({
    queryKey: queryKeys.dashboard.profitAggregated,
    queryFn: fetchProfitPorEmbarque,
  });

  const { ventaMap, costoMap } = useMemo(() => {
    const vm: Record<string, number> = {};
    const cm: Record<string, number> = {};
    profitRows.forEach((r) => {
      vm[r.embarque_id] = Number(r.venta_usd);
      cm[r.embarque_id] = Number(r.costo_usd);
    });
    return { ventaMap: vm, costoMap: cm };
  }, [profitRows]);

  return { ventaMap, costoMap };
}
