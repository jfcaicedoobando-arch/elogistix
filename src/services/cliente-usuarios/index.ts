/**
 * Servicio de usuarios de cliente (portal): listado, invitación y revocación.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ClientUserRow = Tables<"client_users">;

export async function fetchClientUsers(clienteId: string): Promise<ClientUserRow[]> {
  const { data, error } = await supabase
    .from("client_users")
    .select("*")
    .eq("cliente_id", clienteId);
  if (error) throw error;
  return (data ?? []) as ClientUserRow[];
}

export interface InviteClientUserParams {
  email: string;
  cliente_id: string;
  organization_id: string;
}

export async function inviteClientUser(params: InviteClientUserParams) {
  const { data, error } = await supabase.functions.invoke("invite-client-user", {
    body: params,
  });
  if (error) throw error;
  return data;
}

export async function revokeClientUser(id: string): Promise<void> {
  const { error } = await supabase.from("client_users").delete().eq("id", id);
  if (error) throw error;
}
