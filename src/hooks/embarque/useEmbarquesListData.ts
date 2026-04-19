import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Single RPC call to fetch liquidation + document counts for a page of embarques.
 */
export function useEmbarquesListExtras(embarqueIds: string[]) {
  return useQuery({
    queryKey: [...queryKeys.embarques.all, 'list-extras', embarqueIds],
    queryFn: async () => {
      if (embarqueIds.length === 0) return { liquidacion: {}, docs: {} };
      const { data, error } = await supabase.rpc('embarques_list_extras', {
        p_ids: embarqueIds,
      });
      if (error) throw error;

      const liquidacion: Record<string, { total: number; pagados: number }> = {};
      const docs: Record<string, { total: number; pendientes: number }> = {};

      (data ?? []).forEach((row: { embarque_id: string; costos_total: number; costos_pagados: number; docs_total: number; docs_pendientes: number }) => {
        liquidacion[row.embarque_id] = {
          total: Number(row.costos_total),
          pagados: Number(row.costos_pagados),
        };
        docs[row.embarque_id] = {
          total: Number(row.docs_total),
          pendientes: Number(row.docs_pendientes),
        };
      });

      return { liquidacion, docs };
    },
    enabled: embarqueIds.length > 0,
  });
}
