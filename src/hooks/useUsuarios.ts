import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  fetchUsuariosOrganizacion,
  updateUserRole,
  deleteUserViaEdgeFunction,
  type UserRow,
} from '@/services/usuarioService';
import type { AppRole } from "@/types/types";

export type { UserRow };

export function useUsuarios() {
  return useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: fetchUsuariosOrganizacion,
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
