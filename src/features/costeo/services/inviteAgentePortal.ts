/**
 * Servicio: invita o crea cuenta para un agente del Portal vía edge `user-management`.
 */
import { invokeUserManagement } from "@/services/userManagement/invoke";

export interface InviteAgenteInput {
  email: string;
  agente_id: string;
  organization_id: string;
  mode: "email" | "password";
  password?: string;
}

export interface InviteAgenteResult {
  is_new?: boolean;
}

export async function inviteAgentePortal(input: InviteAgenteInput): Promise<InviteAgenteResult> {
  const { data, error } = await invokeUserManagement({
      action: "invite-agente",
      ...input,
      ...(input.mode === "password" ? { password: input.password } : {}),
    });
  if (error) throw error;
  return (data ?? {}) as InviteAgenteResult;
}
