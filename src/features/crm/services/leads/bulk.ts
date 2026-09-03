/**
 * Leads — operaciones en lote (bulk create/update/softDelete).
 *
 * Las tres devuelven la cantidad REAL de filas afectadas (`select("id")`).
 * `ResultadoLote.aviso` se reserva exclusivamente para importaciones parciales:
 * cuando un chunk posterior al primero falla (o al final faltan filas), se
 * devuelve el conteo real y se pide al usuario volver a cargar el archivo para
 * que la deduplicación omita lo ya creado.
 */
import { supabase } from "@/integrations/supabase/client";
import { type LeadInput } from "@/features/crm/domain/leads/constants";
import { buildLeadInsertPayload, type AuthLite } from "@/features/crm/domain/leads/leadPayload";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface ResultadoLote {
  /** Filas realmente afectadas por la operación (puede ser menor a `ids.length`). */
  affected: number;
  /** Aviso secundario no fatal; reservado para importaciones parciales. */
  aviso?: string;
}

function avisoImportacionParcial(creados: number, total: number): string {
  return `Se importaron ${creados} de ${total} leads. Vuelve a cargar el archivo; la deduplicación omitirá los registros ya creados.`;
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
  await registrarActividad({
    modulo: "crm",
    accion: "Actualizó leads en lote",
    detalles: { cantidad: affected, solicitados: ids.length, campos: Object.keys(patch) },
  });
  return { affected };
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
  await registrarActividad({
    modulo: "crm",
    accion: "Eliminó leads en lote",
    detalles: { cantidad: affected, solicitados: ids.length },
  });
  return { affected };
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
    let result: { data: { id: string }[] | null; error: Error | null } | undefined;
    let thrown: Error | undefined;
    try {
      result = await supabase
        .from("crm_leads")
        .insert(chunk)
        .select("id");
    } catch (e) {
      thrown = e instanceof Error ? e : new Error(String(e));
    }
    const error = thrown ?? result?.error ?? null;
    if (error) {
      if (inserted === 0) throw error;
      await registrarActividad({
        modulo: "crm",
        accion: "Importó leads en lote",
        detalles: { cantidad: inserted, solicitados: inputs.length },
      });
      return { affected: inserted, aviso: avisoImportacionParcial(inserted, inputs.length) };
    }
    inserted += (result?.data ?? []).length;
  }

  if (inserted < inputs.length) {
    await registrarActividad({
      modulo: "crm",
      accion: "Importó leads en lote",
      detalles: { cantidad: inserted, solicitados: inputs.length },
    });
    return { affected: inserted, aviso: avisoImportacionParcial(inserted, inputs.length) };
  }

  await registrarActividad({
    modulo: "crm",
    accion: "Importó leads en lote",
    detalles: { cantidad: inserted },
  });
  return { affected: inserted };
}
