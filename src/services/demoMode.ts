/**
 * Devuelve true si el usuario logueado pertenece a la organización demo.
 * Centraliza la llamada a Supabase para cumplir la regla de arquitectura
 * (componentes no importan supabase/client).
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchIsDemoUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_demo_user", { _user_id: userId });
  if (error) return false;
  return Boolean(data);
}
