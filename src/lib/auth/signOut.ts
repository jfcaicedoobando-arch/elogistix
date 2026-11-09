/** Logout confirmado localmente, aun cuando Auth no pueda revocar otras sesiones. */
import { supabase } from "@/integrations/supabase/client";

export interface SignOutResult {
  /** SDK accepted the global request; not proof of remote revocation (401/403/404 are ignored by Auth). */
  globalRequestSucceeded: boolean;
}

export const SIGN_OUT_FAILURE = "No se pudo confirmar el cierre de sesión en este dispositivo. Reintenta antes de dejarlo compartido.";

export async function signOutCurrentSession(): Promise<SignOutResult> {
  let globalRequestSucceeded = false;
  try {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    globalRequestSucceeded = !error;
  } catch {
    // Un fallo del transporte o storage tampoco debe impedir el intento local.
  }
  if (!globalRequestSucceeded) {
    try {
      // Auth 2.119 borra primero la sesión local. Un error remoto aquí NO
      // significa que el dispositivo siga autenticado; comprobarlo abajo.
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // También puede lanzar un suscriptor después de haber eliminado storage.
    }
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error && !data.session) return { globalRequestSucceeded };
  } catch {
    // Nunca propagar respuestas del servidor, credenciales ni detalles de storage.
  }
  throw new Error(SIGN_OUT_FAILURE);
}
