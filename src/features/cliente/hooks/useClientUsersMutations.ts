import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchClientUsers,
  inviteClientUser,
  revokeClientUser,
  type InviteClientUserParams,
} from "@/features/cliente/services/usuarios";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

/**
 * Lista los usuarios del portal vinculados a un cliente específico.
 */
export function useClientUsers(clienteId: string) {
  return useQuery({
    queryKey: queryKeys.clientes.clientUsers(clienteId),
    queryFn: () => fetchClientUsers(clienteId),
    enabled: !!clienteId,
  });
}

export function useInviteClientUser(clienteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: InviteClientUserParams) => inviteClientUser(params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.clientUsers(clienteId) });
      // 13.85.10 — Diferencia "nuevo" vs "vinculado" según respuesta del servicio.
      notifySuccess(undefined, {
        title: data?.is_new ? "Invitación enviada" : "Usuario vinculado",
        description: data?.is_new
          ? "Se creó la cuenta y se envió un correo para establecer contraseña."
          : "El usuario existente fue vinculado a este cliente.",
      });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al invitar usuario: ${error.message}`, error, method: "INVITE_CLIENT_USER" });
    },
  });
}

export function useRevokeClientUser(clienteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeClientUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.clientUsers(clienteId) });
      notifySuccess(undefined, { title: "Acceso revocado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al revocar usuario: ${error.message}`, error, method: "REVOKE_CLIENT_USER" });
    },
  });
}

/**
 * Reenvía la invitación a un usuario del portal reutilizando `user-management` (action `invite-client`),
 * que es idempotente cuando el usuario ya existe (genera nuevo link de recuperación).
 */
export function useResendClientUserInvite(_clienteId: string) {
  return useMutation({
    mutationFn: (params: InviteClientUserParams) => inviteClientUser(params),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Invitación reenviada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al reenviar invitación: ${error.message}`, error, method: "RESEND_CLIENT_USER_INVITE" });
    },
  });
}
