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
  if (error || !data.session) {
    // El refresh puede fallar por "Already Used" cuando el SDK ya lo rotó en
    // paralelo. Si la sesión en memoria quedó vigente, se usa ese token en
    // lugar de tirar al usuario a la pantalla de sesión expirada. Sin embargo,
    // si el servidor ya rechazó ese token (`forzar=true`), nunca se reutiliza:
    // su fecha local puede seguir vigente aunque la sesión haya sido revocada.
    const { data: { session: actual } } = await supabase.auth.getSession();
    if (!forzar && actual && (actual.expires_at ?? 0) > ahora) return actual.access_token;
    return null;
  }
  return data.session.access_token;
}
