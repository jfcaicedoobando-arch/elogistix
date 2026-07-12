/**
 * Servicios del modo demo: detección de membership y suscripción a cambios de auth.
 * Centraliza el acceso al cliente Supabase para cumplir la regla de arquitectura.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchIsDemoUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_demo_user", { _user_id: userId });
  if (error) return false;
  return Boolean(data);
}

