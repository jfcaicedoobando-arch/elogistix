/**
 * Servicio Auth — registro de actividad de login en bitácora.
 * No lanza: el login del usuario nunca debe fallar por la auditoría.
 */
import { supabase } from "@/integrations/supabase/client";

export async function insertLoginAudit(userId: string, email: string): Promise<void> {
  try {
    // DEFECTO 8: el INSERT directo está REVOKE; la RPC deriva usuario_id/email
    // del servidor, así que userId/email sólo se usan para el nombre visible.
    void userId;
    await supabase.rpc("registrar_bitacora", {
      p_modulo: "auth",
      p_accion: "login",
      p_entidad_nombre: email,
    });
  } catch {
    // silent — no bloquear login si falla el registro
  }
}
