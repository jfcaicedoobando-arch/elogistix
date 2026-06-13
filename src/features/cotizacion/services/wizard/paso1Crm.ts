/**
 * I/O puro del paso 1 del wizard de cotización: obtiene el usuario auth
 * actual y el folio de una cotización recién creada. Encapsula las
 * llamadas a Supabase para que el helper `handlePaso1Crm` no las haga
 * directamente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AuthUserLite {
  id: string;
  email: string | undefined;
}

export async function obtenerUsuarioActual(): Promise<AuthUserLite | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? undefined } : null;
}

export async function fetchCotizacionFolio(cotizacionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("folio")
    .eq("id", cotizacionId)
    .maybeSingle();
  if (error) throw error;
  return data?.folio ?? null;
}
