/**
 * Servicios del perfil del agente. Extraído de `AgentePerfil.tsx`
 * (Block 1.6). Wrappea `supabase.auth.updateUser` para que el componente
 * consuma la capa services.
 */
import { supabase } from "@/integrations/supabase/client";

export async function actualizarPasswordAgente(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
