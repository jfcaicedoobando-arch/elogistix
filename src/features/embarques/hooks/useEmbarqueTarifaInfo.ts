/**
 * Lee los campos de decisión de tarifa de un embarque para mostrarlos en
 * sub-encabezados (TabConciliacion, etc) sin volver a fetch del embarque entero.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmbarqueTarifaInfo {
  tarifa_id_original: string | null;
  tarifa_id_aplicada: string | null;
  tarifa_decision: string | null;
  tarifa_delta_jsonb: unknown;
  tarifa_revalidada_en: string | null;
}

export function useEmbarqueTarifaInfo(embarqueId: string | undefined) {
  return useQuery<EmbarqueTarifaInfo | null>({
    queryKey: ["embarques", "tarifa-info", embarqueId],
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("embarques")
        .select(
          "tarifa_id_original, tarifa_id_aplicada, tarifa_decision, tarifa_delta_jsonb, tarifa_revalidada_en",
        )
        .eq("id", embarqueId as string)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as EmbarqueTarifaInfo | null) ?? null;
    },
  });
}
