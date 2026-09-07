/**
 * Devuelve un `access_token` vigente, refrescando la sesión cuando está por
 * vencer (o ya venció). Las Edge Functions validan el JWT contra el backend y
 * responden 401 "Token inválido" con tokens expirados, algo común cuando la
 * pestaña estuvo inactiva mucho tiempo.
 */
import { supabase } from "@/integrations/supabase/client";

const MARGEN_SEGUNDOS = 60;
const ESPERA_ROTACION_MS = 250;

function esColisionDeRotacion(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error ?? "");
  return /already used|refresh token.*used|refresh.*in progress/i.test(mensaje);
}

async function recuperarSesionConcurrente(
  tokenAnterior: string,
  ahora: number,
  error: unknown,
  forzar: boolean,
): Promise<string | null> {
  const esColision = esColisionDeRotacion(error);
  if (esColision) {
    await new Promise<void>((resolve) => setTimeout(resolve, ESPERA_ROTACION_MS));
  }
  const { data: { session: actual } } = await supabase.auth.getSession();
  if (!actual) return null;

  const actualVigente = (actual.expires_at ?? 0) - MARGEN_SEGUNDOS > ahora;
  if (!actualVigente) return null;
  if (actual.access_token !== tokenAnterior) return actual.access_token;
  return !forzar && !esColision ? actual.access_token : null;
}

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
    // Cuando otra pestaña/auto-refresh ya usó el refresh token, esperar a que
    // el SDK publique la sesión rotada antes de releerla. Sólo se acepta si el
    // access token cambió; así nunca se reenvía el mismo JWT que pudo quedar
    // invalidado en el servidor aunque su `expires_at` local siga en futuro.
    return recuperarSesionConcurrente(session.access_token, ahora, error, forzar);
  }
  return data.session.access_token;
}
