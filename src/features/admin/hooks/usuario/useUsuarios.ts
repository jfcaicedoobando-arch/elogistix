import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  fetchUsuariosOrganizacion,
  updateUserRole,
  deleteUserViaEdgeFunction,
  type UserRow,
} from '@/features/admin/services/usuario';
import type { AppRole } from "@/types/appRole";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

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
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      notifySuccess(undefined, { title: `Rol actualizado a ${vars.newRole}` });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al cambiar rol: ${error.message}`, error, method: "UPDATE_USER_ROLE" });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteUserViaEdgeFunction(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      notifySuccess(undefined, { title: "Usuario eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar usuario: ${error.message}`, error, method: "DELETE_USER" });
    },
  });
}
