import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Lista los usuarios del portal vinculados a un cliente específico.
 */
export function useClientUsers(clienteId: string) {
  return useQuery({
    queryKey: queryKeys.clientes.clientUsers(clienteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_users")
        .select("*")
        .eq("cliente_id", clienteId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clienteId,
  });
}

export function useInviteClientUser(clienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { email: string; cliente_id: string; organization_id: string }) => {
      const { data, error } = await supabase.functions.invoke("invite-client-user", {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.clientUsers(clienteId) });
    },
  });
}

export function useRevokeClientUser(clienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_users").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.clientUsers(clienteId) });
    },
  });
}
