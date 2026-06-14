import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  fetchUsuariosOrganizacion,
  updateUserRole,
  deleteUserViaEdgeFunction,
  type UserRow,
} from '@/services/usuario';
import type { AppRole } from "@/types/appRole";

export type { UserRow };

export function useUsuarios() {
  return useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: fetchUsuariosOrganizacion,
    // Catálogo: cambia rara vez, evitar refetch en cada mount.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: AppRole }) =>
      updateUserRole(userId, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.usuarios.all });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteUserViaEdgeFunction(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.usuarios.all });
    },
  });
}
