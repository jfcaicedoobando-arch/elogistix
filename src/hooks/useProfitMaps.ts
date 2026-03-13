import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Hook compartido que consulta conceptos de venta y costo en USD
 * y construye mapas embarque_id → total acumulado.
 *
 * Usado por useDashboardData y useOperacionesData.
 */
export function useProfitMaps() {
  const { data: ventasUSD = [] } = useQuery({
    queryKey: queryKeys.dashboard.ventasUSD,
    queryFn: async () => {
      const { data } = await supabase
        .from("conceptos_venta")
        .select("embarque_id, total")
        .eq("moneda", "USD");
      return data ?? [];
    },
  });

  const { data: costosUSD = [] } = useQuery({
    queryKey: queryKeys.dashboard.costosUSD,
    queryFn: async () => {
      const { data } = await supabase
        .from("conceptos_costo")
        .select("embarque_id, monto")
        .eq("moneda", "USD");
      return data ?? [];
    },
  });

  const { ventaMap, costoMap } = useMemo(() => {
    const vm: Record<string, number> = {};
    const cm: Record<string, number> = {};
    ventasUSD.forEach((v) => {
      vm[v.embarque_id] = (vm[v.embarque_id] || 0) + Number(v.total);
    });
    costosUSD.forEach((c) => {
      cm[c.embarque_id] = (cm[c.embarque_id] || 0) + Number(c.monto);
    });
    return { ventaMap: vm, costoMap: cm };
  }, [ventasUSD, costosUSD]);

  return { ventaMap, costoMap };
}
