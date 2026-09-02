/**
 * Leads — mutaciones individuales (create/update/softDelete/tomar de la bolsa).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase/response";
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

/**
 * v13.823.49 — un UPDATE filtrado por RLS o sobre un lead eliminado devuelve
 * 0 filas SIN error; antes eso se reportaba como éxito.
 */
async function exigirFilaLead(
  builder: PromiseLike<{ data: { id: string } | null; error: unknown }>,
): Promise<void> {
  const { data, error } = await builder;
  if (error) throw error;
  if (!data) {
    throw new Error("No se pudo guardar el lead: no tienes permiso o el lead ya no existe.");
  }
}

export async function updateLead(id: string, patch: Partial<LeadInput>): Promise<void> {
  await exigirFilaLead(
    supabase
      .from("crm_leads")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle(),
  );
  await registrarActividad({
    modulo: "crm",
    accion: "editar_lead",
    entidadId: id,
    detalles: { campos: Object.keys(patch) },
  });
}

export async function softDeleteLead(id: string, userId: string | null): Promise<void> {
  await exigirFilaLead(
    supabase
      .from("crm_leads")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle(),
  );
  await registrarActividad({
    modulo: "crm",
    accion: "eliminar_lead",
    entidadId: id,
    detalles: { deleted_by: userId },
  });
}

/**
 * Ola 6 · O6.1 — toma un lead de la bolsa común (sin vendedor asignado).
 * La RPC valida org, rol de ventas y serializa tomas simultáneas (FOR UPDATE);
 * lanza LC_LEAD_YA_ASIGNADO si otro vendedor llegó primero.
 */
export async function tomarLead(id: string, empresa: string): Promise<void> {
  const { data, error } = await supabase.rpc("crm_tomar_lead", { p_lead_id: id });
  if (error) throw error;
  await registrarActividad({
    modulo: "crm",
    accion: "tomar_lead",
    entidadId: id,
    entidadNombre: empresa,
    detalles: { tomado: (data as { tomado?: boolean } | null)?.tomado ?? true },
  });
}
