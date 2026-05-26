/**
 * Servicio CRM — Actividades. Mutaciones simples sobre `crm_actividades`.
 * Las queries complejas (listado, vencidas) viven aún en `hooks/crm/useActividades`
 * y se migrarán en lotes posteriores.
 */
import { supabase } from "@/integrations/supabase/client";

export async function actualizarActividadNotas(input: { id: string; resultado: string }): Promise<void> {
  const { error } = await supabase
    .from("crm_actividades")
    .update({ resultado: input.resultado })
    .eq("id", input.id);
  if (error) throw error;
}
