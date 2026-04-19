import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Devuelve embarques que comparten BL Master con el embarque actual (excluyéndolo).
 */
export function useEmbarquesRelacionados(embarqueId: string, blMaster: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.relacionados(embarqueId, blMaster ?? ""),
    queryFn: async () => {
      if (!blMaster) return [];
      const { data, error } = await supabase
        .from("embarques")
        .select("id, expediente, bl_house, cliente_nombre, shipper, estado")
        .eq("bl_master", blMaster)
        .neq("id", embarqueId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!blMaster,
  });
}
