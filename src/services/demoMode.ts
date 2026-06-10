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

export async function getCurrentUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

export function subscribeAuthUserId(cb: (userId: string | undefined) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user?.id);
  });
  return () => data.subscription.unsubscribe();
}
