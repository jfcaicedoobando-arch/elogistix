import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Lista de organizaciones (id + nombre) para selectores de admin.
 */
export function useOrganizationsList(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.organizationsList,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nombre")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });
}
