import { supabase } from "@/integrations/supabase/client";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/features/auditoria/types";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface SnoozeRevisionInput {
  organization_id: string;
  embarque_id: string;
  regla: HallazgoAuditoria["regla"];
  detalle_hash: string;
  detalle: string;
  snoozed_until: string; // YYYY-MM-DD
  snooze_motivo: string;
}

export async function snoozeRevision(
  input: SnoozeRevisionInput,
): Promise<AuditoriaRevision> {
  if (!input.organization_id) {
    throw new Error("organization_id requerido para snooze");
  }
  const { data, error } = await supabase
    .from("auditoria_revisiones")
    .upsert(
      {
        organization_id: input.organization_id,
        embarque_id: input.embarque_id,
        regla: input.regla,
        detalle_hash: input.detalle_hash,
        detalle: input.detalle,
        snoozed_until: input.snoozed_until,
        snooze_motivo: input.snooze_motivo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,embarque_id,regla,detalle_hash" },
    )
    .select()
    .single();
  if (error) throw error;
  await registrarActividad({
    modulo: "auditoria",
    accion: "Pospuso hallazgo de auditoría",
    entidadId: (data as AuditoriaRevision).id,
    detalles: {
      embarque_id: input.embarque_id,
      regla: input.regla,
      snoozed_until: input.snoozed_until,
      snooze_motivo: input.snooze_motivo,
    },
  });
  return data as AuditoriaRevision;
}

export async function clearSnoozeRevision(
  revisionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("auditoria_revisiones")
    .update({ snoozed_until: null, snooze_motivo: null })
    .eq("id", revisionId);
  if (error) throw error;
  await registrarActividad({
    modulo: "auditoria",
    accion: "Quitó snooze de hallazgo",
    entidadId: revisionId,
  });
}
