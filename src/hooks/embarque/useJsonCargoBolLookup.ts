import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BolLookupResponse {
  ok: boolean;
  bill_of_lading?: string;
  shipping_line_name?: string;
  shipping_line_id?: string;
  associated_containers?: number;
  associated_container_numbers?: string[];
  last_updated?: string;
  current_contenedor?: string | null;
  error?: string;
  status?: number;
}

export function useJsonCargoBolLookup() {
  return useMutation({
    mutationFn: async (embarqueId: string): Promise<BolLookupResponse> => {
      const { data, error } = await supabase.functions.invoke<BolLookupResponse>(
        "jsoncargo-bol-lookup",
        { body: { embarqueId } },
      );
      if (error) throw error;
      return data!;
    },
  });
}
