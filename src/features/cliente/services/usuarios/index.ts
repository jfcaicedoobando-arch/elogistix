/**
 * Servicio de usuarios de cliente (portal): listado enriquecido, invitación y revocación.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface ClientUserEnriched {
  id: string;
  user_id: string;
  cliente_id: string;
  organization_id: string;
  created_at: string | null;
  email: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

export async function fetchClientUsers(clienteId: string): Promise<ClientUserEnriched[]> {
  const { data, error } = await supabase.functions.invoke("user-management", {
    body: { action: "list-clients", cliente_id: clienteId },
  });
  if (error) throw error;
  return (data ?? []) as ClientUserEnriched[];
}

export interface InviteClientUserParams {
  email: string;
  cliente_id: string;
  organization_id: string;
}

export interface InviteClientUserResult {
  is_new: boolean;
  user_id?: string;
  email?: string;
}

export async function inviteClientUser(
  params: InviteClientUserParams,
): Promise<InviteClientUserResult> {
  const { data, error } = await supabase.functions.invoke("user-management", {
    body: { action: "invite-client", ...params },
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "clientes",
    accion: "Invitó usuario del portal de cliente",
    entidadId: params.cliente_id,
    entidadNombre: params.email,
  });
  return (data ?? { is_new: false }) as InviteClientUserResult;
}

export async function revokeClientUser(id: string): Promise<void> {
  // Defecto 1: el DELETE directo está cerrado por RLS. La RPC valida el rol
  // en la organización del CLIENTE (no la declarada en el vínculo).
  const { error } = await supabase.rpc("revocar_usuario_portal_cliente", { p_id: id });
  if (error) throw error;
  await registrarActividad({
    modulo: "clientes",
    accion: "Revocó usuario del portal de cliente",
    entidadId: id,
  });
}
