
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Supplementary data for the Embarques list view:
 * liquidation status and document status per embarque.
 */

export function useEmbarquesLiquidacion(embarqueIds: string[]) {
  return useQuery({
    queryKey: [...queryKeys.embarques.all, 'liquidacion', embarqueIds],
    queryFn: async () => {
      if (embarqueIds.length === 0) return {};
      const { data, error } = await supabase
        .from('conceptos_costo')
        .select('embarque_id, estado_liquidacion')
        .in('embarque_id', embarqueIds);
      if (error) throw error;
      const map: Record<string, { total: number; pagados: number }> = {};
      (data ?? []).forEach((c) => {
        if (!map[c.embarque_id]) map[c.embarque_id] = { total: 0, pagados: 0 };
        map[c.embarque_id].total++;
        if (c.estado_liquidacion === 'Pagado') map[c.embarque_id].pagados++;
      });
      return map;
    },
    enabled: embarqueIds.length > 0,
  });
}

export function useEmbarquesDocsStatus(embarqueIds: string[]) {
  return useQuery({
    queryKey: [...queryKeys.embarques.all, 'docs-status', embarqueIds],
    queryFn: async () => {
      if (embarqueIds.length === 0) return {};
      const { data, error } = await supabase
        .from('documentos_embarque')
        .select('embarque_id, estado')
        .in('embarque_id', embarqueIds);
      if (error) throw error;
      const map: Record<string, { total: number; pendientes: number }> = {};
      (data ?? []).forEach((d) => {
        if (!map[d.embarque_id]) map[d.embarque_id] = { total: 0, pendientes: 0 };
        map[d.embarque_id].total++;
        if (d.estado !== 'Recibido' && d.estado !== 'Validado') map[d.embarque_id].pendientes++;
      });
      return map;
    },
    enabled: embarqueIds.length > 0,
  });
}
