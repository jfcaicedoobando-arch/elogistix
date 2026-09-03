/**
 * Leads — operaciones en lote (bulk create/update/softDelete).
 *
 * Las tres devuelven la cantidad REAL de filas afectadas (`select("id")`) y un
 * `aviso` secundario no fatal: si la bitácora falla después de una escritura ya
 * confirmada, el resultado principal sigue siendo exitoso (no se debe reintentar).
 */
import { supabase } from "@/integrations/supabase/client";
import { type LeadInput } from "@/features/crm/domain/leads/constants";
import { buildLeadInsertPayload, type AuthLite } from "@/features/crm/domain/leads/leadPayload";
import { registrarActividad, type RegistrarActividadInput } from "@/services/bitacora/registrar";

export interface ResultadoLote {
  /** Filas realmente afectadas por la operación (puede ser menor a `ids.length`). */
  affected: number;
  /** Aviso secundario no fatal (p. ej. la bitácora no se pudo registrar). */
  aviso?: string;
}

const AVISO_BITACORA = "La operación se aplicó, pero no se pudo registrar en bitácora.";

/** Bitácora fire-and-forget: nunca convierte en error una escritura confirmada. */
async function registrarSinRomper(input: RegistrarActividadInput): Promise<string | undefined> {
  try {
    await registrarActividad(input);
    return undefined;
  } catch {
    return AVISO_BITACORA;
  }
}

export async function bulkUpdateLeads(
  ids: string[],
  patch: Partial<LeadInput>,
): Promise<ResultadoLote> {
  if (ids.length === 0) return { affected: 0 };
  const { data, error } = await supabase
    .from("crm_leads")
    .update(patch)
    .in("id", ids)
    .is("deleted_at", null)
    .select("id");
  if (error) throw error;
  const affected = (data ?? []).length;
  const aviso = await registrarSinRomper({
    modulo: "crm",
    accion: "Actualizó leads en lote",
    detalles: { cantidad: affected, solicitados: ids.length, campos: Object.keys(patch) },
  });
  return { affected, aviso };
}

export async function bulkSoftDeleteLeads(
  ids: string[],
  userId: string | null,
): Promise<ResultadoLote> {
  if (ids.length === 0) return { affected: 0 };
  const { data, error } = await supabase
    .from("crm_leads")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .in("id", ids)
    .is("deleted_at", null)
    .select("id");
  if (error) throw error;
  const affected = (data ?? []).length;
  const aviso = await registrarSinRomper({
    modulo: "crm",
    accion: "Eliminó leads en lote",
    detalles: { cantidad: affected, solicitados: ids.length },
  });
  return { affected, aviso };
}

export async function bulkCreateLeads(
  inputs: LeadInput[],
  user: AuthLite | null,
): Promise<ResultadoLote> {
  if (inputs.length === 0) return { affected: 0 };
  const payloads = inputs.map((input) => buildLeadInsertPayload(input, user));
  let inserted = 0;
  for (let i = 0; i < payloads.length; i += 100) {
    const chunk = payloads.slice(i, i + 100);
    const { data, error } = await supabase
      .from("crm_leads")
      .insert(chunk)
      .select("id");
    if (error) throw error;
    inserted += (data ?? []).length;
  }
  const aviso = await registrarSinRomper({
    modulo: "crm",
    accion: "Importó leads en lote",
    detalles: { cantidad: inserted },
  });
  return { affected: inserted, aviso };
}
