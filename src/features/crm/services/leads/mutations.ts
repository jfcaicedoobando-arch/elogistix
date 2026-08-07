/**
 * Leads — mutaciones individuales (create/update/softDelete).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, run } from "@/lib/supabase/response";
import { type LeadInput } from "@/features/crm/domain/leads/constants";
import { buildLeadInsertPayload, type AuthLite } from "@/features/crm/domain/leads/leadPayload";
import { registrarActividad } from "@/services/bitacora/registrar";

export async function createLead(input: LeadInput, user: AuthLite | null): Promise<{ id: string }> {
  const payload = buildLeadInsertPayload(input, user);
  const creado = (await unwrap(
    supabase.from("crm_leads").insert(payload).select("id").single(),
  )) as { id: string };
  await registrarActividad({
    modulo: "crm",
    accion: "crear_lead",
    entidadId: creado.id,
    entidadNombre: input.empresa ?? input.contacto ?? "",
    detalles: { fuente: input.fuente, estado: input.estado },
  });
  return creado;
}

export async function updateLead(id: string, patch: Partial<LeadInput>): Promise<void> {
  await run(supabase.from("crm_leads").update(patch).eq("id", id));
  await registrarActividad({
    modulo: "crm",
    accion: "editar_lead",
    entidadId: id,
    detalles: { campos: Object.keys(patch) },
  });
}

export async function softDeleteLead(id: string, userId: string | null): Promise<void> {
  await run(
    supabase
      .from("crm_leads")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", id),
  );
  await registrarActividad({
    modulo: "crm",
    accion: "eliminar_lead",
    entidadId: id,
    detalles: { deleted_by: userId },
  });
}
