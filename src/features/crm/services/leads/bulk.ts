/**
 * Leads — operaciones en lote (bulk create/update/softDelete).
 */
import { supabase } from "@/integrations/supabase/client";
import { type LeadInput } from "@/features/crm/domain/leads/constants";
import { buildLeadInsertPayload, type AuthLite } from "@/features/crm/domain/leads/leadPayload";
import { registrarActividad } from "@/services/bitacora/registrar";

export async function bulkUpdateLeads(ids: string[], patch: Partial<LeadInput>): Promise<number> {
  if (ids.length === 0) return 0;
  const { error } = await supabase.from("crm_leads").update(patch).in("id", ids);
  if (error) throw error;
  await registrarActividad({
    modulo: "crm",
    accion: "Actualizó leads en lote",
    detalles: { cantidad: ids.length, campos: Object.keys(patch) },
  });
  return ids.length;
}

export async function bulkSoftDeleteLeads(ids: string[], userId: string | null): Promise<number> {
  if (ids.length === 0) return 0;
  const { error } = await supabase
    .from("crm_leads")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .in("id", ids);
  if (error) throw error;
  await registrarActividad({
    modulo: "crm",
    accion: "Eliminó leads en lote",
    detalles: { cantidad: ids.length },
  });
  return ids.length;
}

export async function bulkCreateLeads(inputs: LeadInput[], user: AuthLite | null): Promise<number> {
  if (inputs.length === 0) return 0;
  const payloads = inputs.map((input) => buildLeadInsertPayload(input, user));
  let inserted = 0;
  for (let i = 0; i < payloads.length; i += 100) {
    const chunk = payloads.slice(i, i + 100);
    const { error, count } = await supabase
      .from("crm_leads")
      .insert(chunk, { count: "exact" });
    if (error) throw error;
    inserted += count ?? chunk.length;
  }
  await registrarActividad({
    modulo: "crm",
    accion: "Importó leads en lote",
    detalles: { cantidad: inserted },
  });
  return inserted;
}
