/**
 * Helpers de sesión compartidos por las mutaciones de usuarios.
 * Extraído para respetar el límite de 200 líneas (Power of 10).
 */
import { supabase } from "@/integrations/supabase/client";

/** URL de retorno para invitaciones/restablecimientos (segura en entorno node). */
export function resetRedirectUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/reset-password`;
}

/** Access token de la sesión activa, para invocar edge functions autenticadas. */
export async function getAuthToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}
