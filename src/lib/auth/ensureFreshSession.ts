/**
 * Devuelve un `access_token` vigente, refrescando la sesión cuando está por
 * vencer (o ya venció). Las Edge Functions validan el JWT contra el backend y
 * responden 401 "Token inválido" con tokens expirados, algo común cuando la
 * pestaña estuvo inactiva mucho tiempo.
 */
import { supabase } from "@/integrations/supabase/client";

const MARGEN_SEGUNDOS = 60;

export async function ensureFreshSession(forzar = false): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const ahora = Math.floor(Date.now() / 1000);
  const vigente = (session.expires_at ?? 0) - MARGEN_SEGUNDOS > ahora;
  if (vigente && !forzar) return session.access_token;

  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) return null;
  return data.session.access_token;
}
