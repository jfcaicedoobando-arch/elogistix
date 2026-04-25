import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { addOrgMember, fetchAvailableUsers } from "@/services/adminServices";

/**
 * Lista todos los usuarios disponibles vía edge function `list-users`.
 */
export function useAvailableUsers(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.admin.allUsers, "options"],
    queryFn: fetchAvailableUsers,
    enabled,
  });
}

/**
 * Agrega un miembro a una organización con un rol determinado.
 */
export function useAddOrgMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addOrgMember,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.allUsers });
    },
  });
}
