/**
 * Servicio para cambio de contraseña del usuario autenticado.
 * Se aísla aquí para que los componentes no importen `supabase/client`
 * directamente (regla de arquitectura: components/ → hooks/services/).
 */
import { supabase } from "@/integrations/supabase/client";

export async function updateOwnPassword(nueva: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) throw error;
}
