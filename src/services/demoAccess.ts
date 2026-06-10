/**
 * Servicio de acceso a la cuenta demo.
 * 1) Invoca edge function `demo-access` que provisiona usuario, membership y reinicia datos.
 * 2) Hace signIn con las credenciales devueltas.
 *
 * La contraseña es pública por diseño (cuenta demo compartida).
 */
import { supabase } from "@/integrations/supabase/client";

export interface DemoAccessResult {
  email: string;
}

export async function enterDemoMode(): Promise<DemoAccessResult> {
  const { data, error } = await supabase.functions.invoke<{
    email: string;
    password: string;
    error?: string;
  }>("demo-access", { body: {} });

  if (error) throw new Error(error.message);
  if (!data || data.error || !data.email || !data.password) {
    throw new Error(data?.error ?? "No se pudo provisionar la cuenta demo.");
  }

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  if (signErr) throw new Error(signErr.message);

  return { email: data.email };
}
