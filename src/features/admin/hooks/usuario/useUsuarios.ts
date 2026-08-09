import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  fetchUsuariosOrganizacion,
  updateUserRole,
  deleteUserViaEdgeFunction,
  quitarDeOrganizacion,
  enviarResetPassword,
  type UserRow,
} from '@/features/admin/services/usuario';
import type { AppRole } from "@/types/appRole";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

export type { UserRow };

/**
 * Organización a la que se acota el listado (U-01).
 * `null` ⇒ super_admin viendo todas las organizaciones.
 */
export function useUsuariosOrgScope(): string | null {
  const { effectiveRole } = useAuth();
  const { organizationId } = useOrgActiva();
  return effectiveRole === "super_admin" ? null : organizationId ?? null;
}

export function useUsuarios(opciones?: { enabled?: boolean }) {
  const orgScope = useUsuariosOrgScope();
  return useQuery<UserRow[]>({
    queryKey: queryKeys.usuarios.scope(orgScope),
    queryFn: () => fetchUsuariosOrganizacion(orgScope),
    enabled: opciones?.enabled ?? true,
    // Catálogo: cambia rara vez, evitar refetch en cada mount.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      newRole,
      organizationId,
    }: {
      userId: string;
      newRole: AppRole;
      organizationId?: string | null;
    }) => updateUserRole(userId, newRole, organizationId),
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

/** U-03: quita la membresía sin borrar la cuenta ni el historial. */
export function useQuitarDeOrganizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, organizationId }: { userId: string; organizationId: string }) =>
      quitarDeOrganizacion(userId, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      notifySuccess(undefined, { title: "Usuario quitado de la organización" });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `Error al quitar al usuario: ${error.message}`,
        error,
        method: "QUITAR_DE_ORGANIZACION",
      });
    },
  });
}

/** U-03: envía correo de restablecimiento de contraseña. */
export function useResetPasswordUsuario() {
  return useMutation({
    mutationFn: (userId: string) => enviarResetPassword(userId),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Correo de restablecimiento enviado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `Error al enviar el correo: ${error.message}`,
        error,
        method: "RESET_PASSWORD_USUARIO",
      });
    },
  });
}
