import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { addOrgMember, fetchAvailableUsers } from "@/features/admin/services";

/**
 * Lista todos los usuarios disponibles vía edge function `user-management` (action `list`).
 */
export function useAvailableUsers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.allUsersOptions,
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
