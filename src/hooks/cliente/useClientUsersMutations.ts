import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchClientUsers,
  inviteClientUser,
  revokeClientUser,
  type InviteClientUserParams,
} from "@/services/clientUserService";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.clientUsers(clienteId) });
    },
  });
}

export function useRevokeClientUser(clienteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeClientUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.clientUsers(clienteId) });
    },
  });
}
