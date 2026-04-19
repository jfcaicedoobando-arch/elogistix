import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type { AppRole } from "@/types/types";

interface UserOption {
  id: string;
  email: string;
}

/**
 * Lista todos los usuarios disponibles vía edge function `list-users`.
 */
export function useAvailableUsers(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.admin.allUsers, "options"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("list-users");
      return Array.isArray(data) ? (data as UserOption[]) : [];
    },
    enabled,
  });
}

/**
 * Agrega un miembro a una organización con un rol determinado.
 */
export function useAddOrgMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { organizationId: string; userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("organization_members")
        .insert({
          organization_id: params.organizationId,
          user_id: params.userId,
          role: params.role,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.allUsers });
    },
  });
}
