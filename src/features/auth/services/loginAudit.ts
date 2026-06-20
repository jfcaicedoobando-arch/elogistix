/**
 * Servicio Auth — registro de actividad de login en bitácora.
 * No lanza: el login del usuario nunca debe fallar por la auditoría.
 */
import { supabase } from "@/integrations/supabase/client";

export async function insertLoginAudit(userId: string, email: string): Promise<void> {
  try {
    await supabase.from("bitacora_actividad").insert([
      {
        usuario_id: userId,
        usuario_email: email,
        accion: "login",
        modulo: "auth",
        entidad_nombre: email,
      },
    ]);
  } catch {
    // silent — no bloquear login si falla el registro
  }
}
