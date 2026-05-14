/**
 * Lectura ligera del catálogo de proveedores para selects y wizards.
 * Vive en `services/embarque` porque es donde se consume (conceptos costo).
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchProveedoresForSelect(organizationId: string | null) {
  let query = supabase.from("proveedores").select("id, nombre").order("nombre");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
