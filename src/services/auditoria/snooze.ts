import { supabase } from "@/integrations/supabase/client";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";

export interface SnoozeRevisionInput {
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
  const { data, error } = await supabase
    .from("auditoria_revisiones")
    .upsert(
      {
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
}
